#!/usr/bin/env python3
"""
Worker Gerador de Documentos — Microserviço Independente (FastAPI)
Operação Trabalho / Zeladoria · Subprefeitura Sé · Rede Cidadã

Responsabilidades:
- Receber requisições HTTP multipart ou JSON para gerar Folhas de Ponto e Cartas de Banco.
- Executar os motores de montagem de OpenXML e conversão via LibreOffice em ambiente isolado.
- Expor rotas de saúde (/health), processamento (/processar-folha, /processar-carta),
  download dos resultados e exclusão de temporários.
"""

import os
import shutil
import uuid
import datetime
import subprocess
import logging
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Importa os módulos locais de geração
from gerar_folhas import gerar as gerar_folhas_motor
from gerar_cartas import gerar as gerar_cartas_motor

# Configuração de Logs
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("worker")

BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", BASE_DIR / "jobs_storage"))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Worker Gerador de Documentos",
    version="1.0.0",
    description="Microserviço desacoplado para processamento de Folhas de Ponto e Cartas em PDF/ZIP",
)

# CORS liberado para integração direta com Vercel ou chamadas externas autorizadas
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def limpar_jobs_antigos(horas: int = 12):
    """Remove pastas de jobs que foram criadas há mais de X horas para preservar disco."""
    limite = datetime.datetime.now() - datetime.timedelta(hours=horas)
    if not STORAGE_DIR.exists():
        return
    for item in STORAGE_DIR.iterdir():
        if item.is_dir():
            try:
                mtime = datetime.datetime.fromtimestamp(item.stat().st_mtime)
                if mtime < limite:
                    shutil.rmtree(item, ignore_errors=True)
                    logger.info(f"Limpeza automática: job antigo removido -> {item.name}")
            except Exception as e:
                logger.warning(f"Erro ao verificar limpeza de {item.name}: {e}")


def checar_binario(nome: str) -> bool:
    """Verifica se um executável está disponível no sistema ou variável de ambiente."""
    bin_path = os.environ.get(f"{nome.upper()}_BIN", nome)
    if shutil.which(bin_path):
        return True
    try:
        res = subprocess.run([bin_path, "--version"], capture_output=True, timeout=5)
        return res.returncode == 0
    except Exception:
        return False


@app.get("/health")
def health():
    """Diagnóstico do ambiente de execução do worker."""
    soffice_ok = checar_binario(os.environ.get("SOFFICE_BIN", "soffice"))
    pdftoppm_ok = checar_binario("pdftoppm")
    tpl_folha = (BASE_DIR / "template_folha.docx").exists()
    tpl_carta = (BASE_DIR / "template_carta.docx").exists()

    pronto = soffice_ok and tpl_folha and tpl_carta

    return {
        "status": "online" if pronto else "degradado",
        "pronto_para_producao": pronto,
        "diagnosticos": {
            "libreoffice": soffice_ok,
            "pdftoppm": pdftoppm_ok,
            "template_folha": tpl_folha,
            "template_carta": tpl_carta,
            "storage_gravavel": os.access(STORAGE_DIR, os.W_OK),
        },
        "detalhes": {
            "soffice_bin": os.environ.get("SOFFICE_BIN", "soffice"),
            "storage_dir": str(STORAGE_DIR),
        },
    }


@app.post("/processar-folha")
async def processar_folha(
    background_tasks: BackgroundTasks,
    arquivo: UploadFile = File(..., description="Planilha .xlsx ou .xlsm"),
    mes: int = Form(..., ge=1, le=12, description="Mês (1 a 12)"),
    ano: int = Form(..., ge=2020, le=2050, description="Ano"),
    folgas: str = Form("1,2", description="Dias da semana de folga (0=Dom...6=Sáb)"),
    extra: str = Form("", description="Datas extras de folga (AAAA-MM-DD separadas por vírgula)"),
):
    """
    Processa a planilha de beneficiários e gera o lote completo de Folhas de Ponto.
    Devolve o resumo e as rotas de download dos arquivos (ZIP e preview).
    """
    background_tasks.add_task(limpar_jobs_antigos)

    nome_arquivo = arquivo.filename or "planilha.xlsx"
    ext = Path(nome_arquivo).suffix.lower()
    if ext not in [".xlsx", ".xlsm", ".xls"]:
        raise HTTPException(
            status_code=400,
            detail="Formato inválido. Envie um arquivo Excel (.xlsx ou .xlsm).",
        )

    job_id = str(uuid.uuid4())
    job_dir = STORAGE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    caminho_entrada = job_dir / f"entrada{ext}"

    try:
        # Salva o arquivo enviado
        conteudo = await arquivo.read()
        with open(caminho_entrada, "wb") as f:
            f.write(conteudo)

        # Trata folgas e datas extras
        folgas_set = set(int(x) for x in folgas.split(",") if x.strip().isdigit())
        extras_set = set()
        for s in extra.split(","):
            s = s.strip()
            if s:
                try:
                    extras_set.add(datetime.date.fromisoformat(s))
                except ValueError:
                    pass

        # Executa o motor
        resumo = gerar_folhas_motor(
            entrada=str(caminho_entrada),
            saida=str(job_dir),
            mes=mes,
            ano=ano,
            folga_weekdays=folgas_set,
            extra_dates=extras_set,
        )

        return {
            "ok": True,
            "job_id": job_id,
            "resumo": resumo,
            "links": {
                "zip": f"/jobs/{job_id}/download/folhas_ponto.zip",
                "preview": f"/jobs/{job_id}/download/preview_folha_1.png",
            },
        }

    except Exception as e:
        logger.exception(f"Erro no processamento do job {job_id}")
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao gerar folhas de ponto: {str(e)}",
        )


@app.post("/processar-carta")
async def processar_carta(
    background_tasks: BackgroundTasks,
    arquivo: UploadFile = File(..., description="Planilha .xlsx ou .xlsm"),
    data: str = Form(..., description="Data da carta (formato AAAA-MM-DD)"),
    assinatura: Optional[UploadFile] = File(None, description="Assinatura digital em PNG (opcional)"),
):
    """
    Processa a planilha de beneficiários e gera as Cartas de Banco com ou sem assinatura.
    Devolve o resumo e as rotas de download dos arquivos (ZIP e preview).
    """
    background_tasks.add_task(limpar_jobs_antigos)

    nome_arquivo = arquivo.filename or "planilha.xlsx"
    ext = Path(nome_arquivo).suffix.lower()
    if ext not in [".xlsx", ".xlsm", ".xls"]:
        raise HTTPException(
            status_code=400,
            detail="Formato inválido. Envie um arquivo Excel (.xlsx ou .xlsm).",
        )

    try:
        data_obj = datetime.date.fromisoformat(data)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use o formato AAAA-MM-DD.")

    job_id = str(uuid.uuid4())
    job_dir = STORAGE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    caminho_entrada = job_dir / f"entrada{ext}"

    try:
        conteudo = await arquivo.read()
        with open(caminho_entrada, "wb") as f:
            f.write(conteudo)

        assinatura_bytes = b""
        if assinatura:
            assinatura_bytes = await assinatura.read()
            if assinatura_bytes and not assinatura_bytes.startswith(b"\x89PNG"):
                raise HTTPException(
                    status_code=400,
                    detail="A assinatura digital deve ser uma imagem no formato PNG.",
                )

        resumo = gerar_cartas_motor(
            entrada=str(caminho_entrada),
            saida=str(job_dir),
            data=data_obj,
            assinatura=assinatura_bytes,
        )

        return {
            "ok": True,
            "job_id": job_id,
            "resumo": resumo,
            "links": {
                "zip": f"/jobs/{job_id}/download/cartas_banco.zip",
                "preview": f"/jobs/{job_id}/download/preview_carta_1.png",
            },
        }

    except HTTPException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise
    except Exception as e:
        logger.exception(f"Erro no processamento da carta para o job {job_id}")
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao gerar cartas de banco: {str(e)}",
        )


@app.get("/jobs/{job_id}/download/{nome_arquivo}")
def baixar_arquivo(job_id: str, nome_arquivo: str):
    """Download direto do arquivo gerado (ZIP, preview PNG ou PDF individual)."""
    caminho = STORAGE_DIR / job_id / nome_arquivo
    if not caminho.exists() or not caminho.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

    ext = caminho.suffix.lower()
    media_types = {
        ".zip": "application/zip",
        ".png": "image/png",
        ".pdf": "application/pdf",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(caminho),
        media_type=media_type,
        filename=nome_arquivo,
    )


@app.delete("/jobs/{job_id}")
def remover_job(job_id: str):
    """Exclui a pasta temporária de um job após o download ou salvamento externo."""
    job_dir = STORAGE_DIR / job_id
    if job_dir.exists() and job_dir.is_dir():
        shutil.rmtree(job_dir, ignore_errors=True)
        return {"ok": True, "mensagem": f"Job {job_id} removido com sucesso."}
    return {"ok": True, "mensagem": "Job já não existe."}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info(f"Iniciando Worker de Documentos em http://{host}:{port}")
    uvicorn.run("server:app", host=host, port=port, reload=False)


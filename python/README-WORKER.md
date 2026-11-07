# Worker Gerador de Documentos (Microserviço Independente)

Microserviço desacoplado responsável por processar planilhas Excel e gerar Folhas de Ponto e Cartas de Banco em formato PDF/ZIP com fidelidade visual absoluta (usando manipulação direta de OpenXML e LibreOffice).

---

## 1. Estrutura do Módulo

* `server.py`: API FastAPI independente expondo os endpoints de processamento.
* `gerar_folhas.py`: Motor de montagem do XML da tabela de ponto e divisão de PDFs.
* `gerar_cartas.py`: Motor de substituição de dados e assinatura digital em cartas bancárias.
* `template_folha.docx`: Modelo padrão de Folha de Ponto.
* `template_carta.docx`: Modelo padrão de Carta de Banco.
* `requirements.txt`: Dependências Python (`fastapi`, `uvicorn`, `openpyxl`, `pypdf`, etc.).

---

## 2. Como Rodar com Docker

Para subir o worker isoladamente em qualquer servidor ou provedor (Cloud Run, Railway, Render, VPS):

```bash
# 1. Construir a imagem a partir da raiz do projeto:
docker build -f deploy/Dockerfile.worker -t worker-folha .

# 2. Executar o container na porta 8000:
docker run -d -p 8000:8000 --name worker-folha-app worker-folha
```

---

## 3. Endpoints Disponíveis

Acesse a documentação interativa Swagger em: **`http://localhost:8000/docs`**

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/health` | Verifica saúde do worker (status do LibreOffice, pdftoppm e templates) |
| `POST` | `/processar-folha` | Recebe arquivo Excel (`.xlsx`), mês, ano, folgas e devolve links do ZIP e preview |
| `POST` | `/processar-carta` | Recebe arquivo Excel (`.xlsx`), data e assinatura opcional (`.png`) |
| `GET` | `/jobs/{job_id}/download/{arquivo}` | Download direto do arquivo gerado (`folhas_ponto.zip`, preview, etc.) |
| `DELETE` | `/jobs/{job_id}` | Exclui a pasta temporária do job após a entrega |

---

## 4. Exemplo de Chamada via `curl`

### Diagnóstico de Saúde:
```bash
curl http://localhost:8000/health
```

### Processamento de Folha de Ponto:
```bash
curl -X POST "http://localhost:8000/processar-folha" \
  -F "arquivo=@planilha.xlsx" \
  -F "mes=10" \
  -F "ano=2026" \
  -F "folgas=1,2" \
  -F "extra="
```


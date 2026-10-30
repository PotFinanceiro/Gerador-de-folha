#!/usr/bin/env python3
"""
Emissão de carta de banco — Programa Operação Trabalho / Rede Cidadã.

Uso:
  python gerar_cartas.py --entrada base.xlsm --saida DIR --data 2026-10-31 \
      [--assinatura assinatura.png]

O template (template_carta.docx) NÃO é alterado: apenas os valores das linhas
NOME / BENEFÍCIO / AGÊNCIA / NOME DA AGÊNCIA / data / Endereço da Agencia são
trocados e, se enviada, a assinatura digital substitui a imagem de assinatura
do modelo (mesma posição e tamanho).

Saídas em DIR:
  cartas_banco.zip      — ZIP com 1 PDF por beneficiário (Carta_Nº_Nome.pdf)
  preview_carta_1.png   — miniatura da 1ª carta
  resumo.json           — resumo do processamento (inclui "pulados")
"""
import argparse, datetime, json, os, re, subprocess, unicodedata, zipfile
import openpyxl
from pypdf import PdfReader, PdfWriter
from xml.sax.saxutils import escape

BASE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(BASE, "template_carta.docx")
IMG_ASSINATURA = "word/media/image3.png"  # imagem de assinatura do modelo

MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
            'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

# (rótulo da linha no modelo, valor original no modelo, campo do beneficiário)
SUBS = [
    ('NOME:', 'Genicassia Ferreira dos Santos', 'nome'),
    ('NÚMERO BENEFÍCIO:', '409013', 'benef'),
    ('AGÊNCIA:', '1205', 'agencia'),
    ('NOME DA AGÊNCIA:', 'AVENIDA CURSINO SP', 'nome_ag'),
    ('Endereço da Agencia:', 'AVENIDA DO CURSINO,1194 -  - PROXIMO AO FINAL DA AV BOSQUE', 'endereco'),
]
ROTULO_DATA = 'São Paulo,'
TITULO_CARTA = 'AUTORIZAÇÃO PARA RETIRADA'  # usado para localizar o início de cada carta no PDF


def sem_acento(s):
    return unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode('ascii')


def limpa(v):
    if v is None:
        return ''
    return re.sub(r'\s+', ' ', str(v).strip())


def num_str(v):
    """408527 / 408527.0 / '408527 ' -> '408527'; demais -> texto limpo."""
    if isinstance(v, bool):
        return limpa(v)
    if isinstance(v, (int, float)):
        return str(int(v)) if float(v).is_integer() else limpa(v)
    return limpa(v)


def chave_ag(v):
    return re.sub(r'\D', '', num_str(v))


# ================= leitura da planilha =================
def ler_planilha(path):
    """Detecta a aba de dados (Nome + Benefício/Agência) e a lista de agências."""
    wb = openpyxl.load_workbook(path, data_only=True)
    ws_dados = ws_ag = None
    for sh in wb.worksheets:
        try:
            hdr = [sem_acento(limpa(c.value)).lower() for c in sh[1][:13]]
        except Exception:
            continue
        if ws_dados is None and any(h == 'nome' for h in hdr) and \
                any('beneficio' in h or h.startswith('agencia') for h in hdr):
            ws_dados = sh
        if ws_ag is None and any('prefixo' in h for h in hdr) and any('dependencia' in h for h in hdr):
            ws_ag = sh
    if ws_dados is None:
        raise ValueError('Não encontrei a aba de dados (precisa ter colunas "Nome" e "Benefício/Agência").')

    hdr = [sem_acento(limpa(c.value)).lower() for c in ws_dados[1][:13]]
    def col(pred):
        for i, h in enumerate(hdr):
            if pred(h):
                return i
        return None
    c_nome = col(lambda h: h == 'nome')
    c_benef = col(lambda h: 'beneficio' in h)
    c_ag = col(lambda h: h.startswith('agencia') and 'nome' not in h)
    c_nome_ag = col(lambda h: 'nome' in h and 'agencia' in h)
    c_end = col(lambda h: 'endereco' in h)
    if c_nome is None or c_benef is None:
        raise ValueError('Colunas "Nome" e "Número do Benefício" são obrigatórias na aba de dados.')

    mapa_ag = {}
    if ws_ag is not None:
        for r in ws_ag.iter_rows(min_row=2, values_only=True):
            pref = chave_ag(r[0]) if r[0] is not None else ''
            if pref:
                mapa_ag.setdefault(pref, (limpa(r[1]), limpa(r[4])))

    beneficiarios, pulados = [], []
    for r in ws_dados.iter_rows(min_row=2, values_only=True):
        nome = limpa(r[c_nome]) if c_nome < len(r) else ''
        if not nome:
            continue
        get = lambda i: (limpa(r[i]) if i is not None and i < len(r) and r[i] is not None else '')
        b = {
            'nome': nome,
            'benef': num_str(r[c_benef]) if c_benef < len(r) and r[c_benef] is not None else '',
            'agencia': num_str(r[c_ag]) if c_ag is not None and c_ag < len(r) and r[c_ag] is not None else '',
            'nome_ag': get(c_nome_ag),
            'endereco': get(c_end),
        }
        info = mapa_ag.get(chave_ag(b['agencia']))
        if info:
            b['nome_ag'] = b['nome_ag'] or info[0]
            b['endereco'] = b['endereco'] or info[1]
        faltando = [campo for campo, v in
                    (('Nome', b['nome']), ('Número do Benefício', b['benef']), ('Agência', b['agencia']),
                     ('Nome da Agência', b['nome_ag']), ('Endereço da Agência', b['endereco'])) if not v]
        if faltando:
            pulados.append({'nome': nome, 'motivo': 'Sem dado: ' + ', '.join(faltando)})
            continue
        beneficiarios.append(b)
    return beneficiarios, pulados


# ================= montagem do documento =================
def trocar_data(corpo, novo):
    """A data do modelo é um campo TIME (o LibreOffice recalcula a cada conversão).
    Troca o campo inteiro por texto fixo com a data configurada — mesmo visual."""
    alvo = sem_acento(ROTULO_DATA).upper()
    for m in re.finditer(r'<w:p\b.*?</w:p>', corpo, re.S):
        bloco = m.group(0)
        texto = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', bloco, re.S))
        if not sem_acento(texto).upper().startswith(alvo):
            continue
        ini = sep = fim = None
        for r in re.finditer(r'<w:r\b.*?</w:r>', bloco, re.S):
            t = r.group(0)
            if 'fldCharType="begin"' in t and ini is None:
                ini = r.start()
            elif 'fldCharType="separate"' in t and ini is not None:
                sep = t
            elif 'fldCharType="end"' in t and ini is not None:
                fim = r.end()
                break
        if ini is None or fim is None or sep is None:
            raise RuntimeError('Campo de data inesperado no modelo.')
        rpr = re.search(r'<w:rPr>.*?</w:rPr>', sep, re.S)
        run = f'<w:r>{rpr.group(0) if rpr else ""}<w:t xml:space="preserve">{escape(novo)}</w:t></w:r>'
        return corpo[:m.start()] + bloco[:ini] + run + bloco[fim:] + corpo[m.end():]
    raise RuntimeError('Linha da data não encontrada no modelo.')


# parágrafo final do modelo reescrito: altura mínima (cabe na página cheia, que
# de outro modo transborda) + quebra de página entre cartas — visual idêntico
PARA_FIM = ('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="14" w:lineRule="exact"/>'
            '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr>{quebra}</w:p>')


def fechar_carta(corpo, quebra):
    """O parágrafo final vazio do modelo vira altura mínima (nunca transborda) e,
    entre cartas, a quebra de página entra no fim do parágrafo do endereço —
    parágrafo com conteúdo, que o LibreOffice mantém na própria página."""
    i = corpo.rfind('</w:p>')
    if i == -1:
        raise RuntimeError('Template sem parágrafo final para fechar a carta.')
    j = max(corpo.rfind('<w:p ', 0, i), corpo.rfind('<w:p>', 0, i))
    corpo = corpo[:j] + PARA_FIM.format(quebra='') + corpo[i + len('</w:p>'):]
    if not quebra:
        return corpo
    k = corpo.rfind('</w:p>', 0, corpo.rfind('</w:p>'))
    if k == -1:
        raise RuntimeError('Template sem parágrafo do endereço para a quebra.')
    return corpo[:k] + '<w:r><w:br w:type="page"/></w:r>' + corpo[k:]


def trocar_valor(corpo, rotulo, antigo, novo):
    """No parágrafo que começa com o rótulo, troca o <w:t> que contém o valor original."""
    alvo = sem_acento(rotulo).upper()
    for m in re.finditer(r'<w:p\b.*?</w:p>', corpo, re.S):
        bloco = m.group(0)
        texto = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', bloco, re.S))
        if not sem_acento(texto).upper().startswith(alvo):
            continue
        for um in reversed(list(re.finditer(r'(<w:t[^>]*>)([^<]*)(</w:t>)', bloco))):
            if antigo in um.group(2):
                return corpo[:m.start()] + bloco[:um.start(2)] + escape(novo) + bloco[um.end(2):] + corpo[m.end():]
        raise RuntimeError(f'Valor do modelo não encontrado em {rotulo!r}: {antigo!r}')
    raise RuntimeError(f'Rótulo não encontrado no modelo: {rotulo!r}')


def corpo_beneficiario(body_tpl, b, data_ext, page_break, id_offset):
    corpo = body_tpl
    for rotulo, antigo, campo in SUBS:
        corpo = trocar_valor(corpo, rotulo, antigo, b[campo])
    corpo = trocar_data(corpo, data_ext)
    if id_offset:  # ids de desenho únicos por página
        corpo = re.sub(r'(docPr id=")(\d+)', lambda m: m.group(1) + str(int(m.group(2)) + id_offset), corpo)
        corpo = re.sub(r'(o:spid="_x0000_s)(\d+)', lambda m: m.group(1) + str(int(m.group(2)) + id_offset), corpo)
    return fechar_carta(corpo, page_break)


def nome_arquivo(benef, nome):
    n = re.sub(r'[^A-Za-z0-9]+', '_', sem_acento(nome)).strip('_')
    c = chave_ag(benef)
    return f'Carta_{c}_{n}' if c else f'Carta_{n}'


def gerar(entrada, saida, data, assinatura):
    os.makedirs(saida, exist_ok=True)
    beneficiarios, pulados = ler_planilha(entrada)
    if not beneficiarios:
        raise ValueError('Nenhum beneficiário com dados completos na planilha.')
    data_ext = f"{data.day} de {MESES_PT[data.month - 1]} de {data.year}"

    zin = zipfile.ZipFile(TEMPLATE)
    xml = zin.read('word/document.xml').decode('utf-8')
    m_body = re.search(r'(<w:body>)(.*)(<w:sectPr)', xml, re.DOTALL)
    if not m_body:
        raise RuntimeError('Estrutura do template inesperada (body).')
    body_tpl = m_body.group(2)

    partes = [corpo_beneficiario(body_tpl, b, data_ext, i < len(beneficiarios) - 1, i * 5000)
              for i, b in enumerate(beneficiarios)]
    new_xml = xml[:m_body.start(2)] + ''.join(partes) + xml[m_body.end(2):]

    docx_path = os.path.join(saida, '_lote.docx')
    with zipfile.ZipFile(docx_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.namelist():
            dado = zin.read(item)
            if item == 'word/document.xml':
                dado = new_xml.encode('utf-8')
            elif item == IMG_ASSINATURA and assinatura:
                dado = assinatura  # assinatura digital no lugar da original, mesmo tamanho/posição
            zout.writestr(item, dado)

    soffice = os.environ.get('SOFFICE_BIN', 'soffice')
    subprocess.run([soffice, '--headless', '--convert-to', 'pdf', '--outdir', saida, docx_path],
                   check=True, capture_output=True, timeout=600)
    pdf_lote = os.path.join(saida, '_lote.pdf')
    reader = PdfReader(pdf_lote)
    # cada carta começa na página em que aparece o título do modelo
    titulos = [i for i, p in enumerate(reader.pages) if TITULO_CARTA in (p.extract_text() or '')]
    if len(titulos) != len(beneficiarios):
        raise RuntimeError(f'Encontrei {len(titulos)} cartas no PDF para {len(beneficiarios)} beneficiários — '
                           'verifique valores muito longos na planilha.')
    limites = titulos + [len(reader.pages)]

    usados, arquivos = set(), []
    for i, b in enumerate(beneficiarios):
        w = PdfWriter()
        for pg in range(titulos[i], limites[i + 1]):
            w.add_page(reader.pages[pg])
        base = nome_arquivo(b['benef'], b['nome'])
        nome, k = base + '.pdf', 2
        while nome in usados:
            nome = f'{base}_{k}.pdf'
            k += 1
        usados.add(nome)
        with open(os.path.join(saida, nome), 'wb') as f:
            w.write(f)
        arquivos.append(nome)

    subprocess.run(['pdftoppm', '-png', '-r', '110', '-f', '1', '-l', '1', '-singlefile',
                    pdf_lote, os.path.join(saida, 'preview_carta_1')], check=True, timeout=120)

    zip_path = os.path.join(saida, 'cartas_banco.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for nome in arquivos:
            z.write(os.path.join(saida, nome), nome)

    resumo = {
        'ok': True,
        'data': data_ext,
        'total': len(beneficiarios),
        'pulados': pulados,
        'assinatura': 'digital' if assinatura else 'original do modelo',
        'arquivos': arquivos,
        'zip': 'cartas_banco.zip',
        'preview': 'preview_carta_1.png',
        'primeiro': beneficiarios[0]['nome'],
    }
    with open(os.path.join(saida, 'resumo.json'), 'w', encoding='utf-8') as f:
        json.dump(resumo, f, ensure_ascii=False, indent=2)
    for tmp in ('_lote.docx', '_lote.pdf'):
        try:
            os.remove(os.path.join(saida, tmp))
        except OSError:
            pass
    return resumo


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--entrada', required=True)
    ap.add_argument('--saida', required=True)
    ap.add_argument('--data', required=True, help='AAAA-MM-DD (data da carta)')
    ap.add_argument('--assinatura', default='', help='PNG da assinatura digital (opcional)')
    args = ap.parse_args()
    try:
        data = datetime.date.fromisoformat(args.data)
    except ValueError:
        raise SystemExit('Data inválida. Use AAAA-MM-DD.')
    ass = open(args.assinatura, 'rb').read() if args.assinatura else b''
    if ass and not ass.startswith(b'\x89PNG'):
        raise SystemExit('A assinatura precisa ser um arquivo PNG.')
    print(json.dumps(gerar(args.entrada, args.saida, data, ass), ensure_ascii=False, indent=2))

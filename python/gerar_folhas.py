#!/usr/bin/env python3
"""
Sistema de geração de folhas de ponto — Operação Trabalho / Zeladoria (Subprefeitura Sé).

Uso:
  python gerar_folhas.py --entrada planilha.xlsm --saida DIR \
      --mes 10 --ano 2026 --folgas 1,2 --extra 2026-12-25,2026-12-31

Saídas em DIR:
  folhas_ponto.zip      — ZIP com 1 PDF por beneficiário (nome: Cartao_Nome.pdf)
  preview_folha_1.png   — miniatura da 1ª folha
  resumo.json           — resumo do processamento
"""
import argparse, calendar, datetime, json, os, re, subprocess, sys, unicodedata, zipfile
from xml.sax.saxutils import escape
import openpyxl
from pypdf import PdfReader, PdfWriter

BASE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(BASE, "template_folha.docx")

DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']  # índice = convenção da macro (Dom=0)
DIAS_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
             'quinta-feira', 'sexta-feira', 'sábado']
MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
            'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
CURSO_MAP = {  # valor da coluna "Curso dia" -> índice em DIAS
    'DOMINGO': 0, 'SEGUNDA-FEIRA': 1, 'SEGUNDA': 1, 'TERCA-FEIRA': 2, 'TERÇA-FEIRA': 2, 'TERCA': 2, 'TERÇA': 2,
    'QUARTA-FEIRA': 3, 'QUARTA': 3, 'QUINTA-FEIRA': 4, 'QUINTA': 4,
    'SEXTA-FEIRA': 5, 'SEXTA': 5, 'SABADO': 6, 'SÁBADO': 6,
}

# ================= métricas calibradas do template (não alterar) =================
COLW = [1.880, 3.268, 2.972, 10.117]   # cm — colunas DIA / DIA SEMANA / APONTAMENTO / ASSINATURA
ROW_HEADER = 240    # twips
ROW_BODY = 302      # twips
ARTEF_H_CM = 0.91   # linha artefato (área vazia do OLE original)
ESPACO_P9_CM = 0.435


def cm2tw(cm):
    return str(int(round(cm * 567.0)))


# ================= geração do XML da tabela (idêntica ao modelo) =================
BORDER = ('<w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
          '<w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
          '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
          '<w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
          '<w:insideH w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
          '<w:insideV w:val="single" w:sz="6" w:space="0" w:color="000000"/>')
LIGHT = ('<w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
         '<w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
         '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
         '<w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>')


def cell_xml(text, width_cm, shd=None, color='000000', size=20, vmerge=None):
    tcpr = [f'<w:tcW w:w="{cm2tw(width_cm)}" w:type="dxa"/>']
    if vmerge == 'restart':
        tcpr.append('<w:vMerge w:val="restart"/>')
    elif vmerge == 'continue':
        tcpr.append('<w:vMerge/>')
    if shd:
        tcpr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shd}"/>')
    tcpr.append('<w:vAlign w:val="center"/>')
    rpr = (f'<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'
           f'<w:color w:val="{color}"/><w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>')
    t = f'<w:t xml:space="preserve">{escape(text)}</w:t>' if text else ''
    p = (f'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>'
         f'<w:jc w:val="center"/>{rpr}</w:pPr>' + (f'<w:r>{rpr}{t}</w:r>' if text else '') + '</w:p>')
    return f'<w:tc><w:tcPr>{"".join(tcpr)}</w:tcPr>{p}</w:tc>'


def blocos_assinatura(mes, ano):
    """Blocos semanais da coluna ASSINATURA (terminam nos domingos), como no modelo."""
    merges, start = [], 1
    ultimo = calendar.monthrange(ano, mes)[1]
    for dia in range(1, 32):
        if dia <= ultimo and datetime.date(ano, mes, dia).weekday() == 6 and dia != 31:
            merges.append((start, dia))
            start = dia + 1
    merges.append((start, 31))
    return merges


def tabela_xml(mes, ano, folga_weekdays, extra_dates, curso_idx):
    """Gera o XML da tabela da agenda para um mês/config."""
    ultimo = calendar.monthrange(ano, mes)[1]
    linhas = []  # (dia_str, dia_sem, apontamento, folga_bool)
    for i in range(1, 32):
        if i <= ultimo:
            d = datetime.date(ano, mes, i)
            idx = (d.weekday() + 1) % 7
            dn = DIAS[idx]
            folga = (idx in folga_weekdays) or (d in extra_dates)
            ap = 'Folga' if folga else ('Curso' if idx == curso_idx else '')
        else:
            dn, folga, ap = '', False, ''
        linhas.append((str(i) if i <= ultimo else '', dn, ap, folga))

    merges = blocos_assinatura(mes, ano)
    rows = []
    hdr = ['DIA', 'DIA DA SEMANA', 'APONTAMENTO', 'ASSINATURA']
    cells = ''.join(cell_xml(t, COLW[i], shd='000000', color='FFFFFF', size=18) for i, t in enumerate(hdr))
    rows.append(f'<w:tr><w:trPr><w:trHeight w:val="{ROW_HEADER}" w:hRule="exact"/></w:trPr>{cells}</w:tr>')

    for idx, (dia, ds, ap, folga) in enumerate(linhas, start=1):
        fill = 'BFBFBF' if folga else None
        c1 = cell_xml(dia, COLW[0], shd=fill, size=20)
        c2 = cell_xml(ds, COLW[1], shd=fill, size=20)
        c3 = cell_xml(ap, COLW[2], shd=fill, size=22)
        vm = None
        for a, b in merges:
            if idx == a:
                vm = 'restart'
                break
            if a < idx <= b:
                vm = 'continue'
                break
        c4 = cell_xml('', COLW[3], vmerge=vm)
        rows.append(f'<w:tr><w:trPr><w:trHeight w:val="{ROW_BODY}" w:hRule="exact"/></w:trPr>{c1}{c2}{c3}{c4}</w:tr>')

    # linha artefato (área vazia do objeto original)
    art_row = (f'<w:tr><w:trPr><w:trHeight w:val="{cm2tw(ARTEF_H_CM)}" w:hRule="exact"/></w:trPr>'
               f'<w:tc><w:tcPr><w:tcW w:w="{cm2tw(sum(COLW))}" w:type="dxa"/><w:gridSpan w:val="4"/>'
               f'<w:tcBorders>{LIGHT}</w:tcBorders><w:vAlign w:val="top"/></w:tcPr>'
               '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="14" w:lineRule="exact"/>'
               '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p></w:tc></w:tr>')
    rows.append(art_row)

    tblpr = (f'<w:tblPr><w:tblW w:w="{cm2tw(sum(COLW))}" w:type="dxa"/>'
             f'<w:tblInd w:w="-567" w:type="dxa"/>'
             f'<w:tblBorders>{BORDER}</w:tblBorders>'
             f'<w:tblLayout w:type="fixed"/>'
             f'<w:tblCellMar><w:left w:w="15" w:type="dxa"/><w:right w:w="15" w:type="dxa"/></w:tblCellMar>'
             f'</w:tblPr>')
    grid = ''.join(f'<w:gridCol w:w="{cm2tw(w)}"/>' for w in COLW)
    # obs: o espacador após a tabela já existe no template (não duplicar aqui)
    return f'<w:tbl>{tblpr}<w:tblGrid>{grid}</w:tblGrid>{"".join(rows)}</w:tbl>'


# ================= normalização de dados =================
def limpa(s):
    if s is None:
        return ''
    s = str(s).strip()
    return re.sub(r'\s+', ' ', s)


def norm_cpf(v):
    s = limpa(v)
    if not s:
        return ''
    tem_pontuacao = bool(re.search(r'[.\-]', s))
    digitos = re.sub(r'\D', '', s)
    if not tem_pontuacao and 1 <= len(digitos) <= 11:
        # mesmo comportamento do TEXT(...,"000.000.000-00") da planilha: zeros à esquerda
        d = digitos.zfill(11)
        return f'{d[0:3]}.{d[3:6]}.{d[6:9]}-{d[9:11]}'
    return s


def norm_periodo(v):
    s = limpa(v).lower()
    if not s:
        return ''
    if 'manh' in s:
        return 'Manhã'
    if 'tard' in s:
        return 'Tarde'
    if 'noit' in s:
        return 'Noite'
    return limpa(v)


def norm_subpref(v):
    s = limpa(v)
    if not s:
        return ''
    if s.lower() in ('se', 'sé'):
        return 'Sé'
    return s


def norm_curso_idx(v):
    s = limpa(v).upper()
    if not s:
        return None
    try:
        s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
    except Exception:
        pass
    s = s.replace(' FEIRA', '-FEIRA').strip()
    if s in CURSO_MAP:
        return CURSO_MAP[s]
    # tenta casar por prefixo
    for k, idx in CURSO_MAP.items():
        if s.startswith(k.split('-')[0]):
            return idx
    return None


def norm_tcr(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime('%d/%m/%Y')
    s = limpa(v)
    if not s:
        return ''
    try:
        d = datetime.datetime.strptime(s[:10], '%Y-%m-%d')
        return d.strftime('%d/%m/%Y')
    except Exception:
        return s


def nome_arquivo(cartao, nome):
    n = unicodedata.normalize('NFKD', limpa(nome)).encode('ascii', 'ignore').decode('ascii')
    n = re.sub(r'[^A-Za-z0-9]+', '_', n).strip('_')
    c = re.sub(r'\D', '', str(cartao or ''))
    base = f'{c}_{n}' if c else n
    return base or 'beneficiario'


def ler_planilha(path):
    """Lê a aba de beneficiários e devolve lista de dicts normalizados."""
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = None
    for sh in wb.worksheets:
        try:
            hdr = [limpa(c.value).lower() for c in sh[1][:13]]
        except Exception:
            continue
        if 'nome' in hdr and any('cart' in h for h in hdr):
            ws = sh
            break
    if ws is None:
        ws = wb.worksheets[0]
    hdr = [limpa(c.value).lower() for c in ws[1][:13]]
    def col(*names):
        for i, h in enumerate(hdr):
            for nm in names:
                if h == nm or (nm in h and len(nm) > 3):
                    return i
        return None
    c = {
        'ordem': col('ordem'), 'projeto': col('projeto'), 'cartao': col('num_cartao', 'cartao'),
        'nome': col('nome'), 'agencia': col('agencia'), 'rg': col('rg'), 'cpf': col('cpf'),
        'sub': col('subprefeitura'), 'tcr': col('tcr'), 'frente': col('frente de trabalho', 'frente'),
        'periodo': col('período', 'periodo'), 'curso': col('curso dia', 'curso'),
    }
    if c['nome'] is None:
        raise ValueError('Coluna "Nome" não encontrada na planilha.')
    beneficiarios = []
    for row in ws.iter_rows(min_row=2, max_col=13):
        nome = limpa(row[c['nome']].value) if c['nome'] is not None and row[c['nome']].value else ''
        if not nome:
            continue
        get = lambda k: (limpa(row[c[k]].value) if c[k] is not None and row[c[k]].value is not None else '')
        b = {
            'ordem': get('ordem'), 'projeto': get('projeto') or 'Zeladoria',
            'cartao': get('cartao'), 'nome': nome, 'agencia': get('agencia'),
            'rg': get('rg'), 'cpf': norm_cpf(get('cpf')), 'sub': norm_subpref(get('sub')),
            'tcr': norm_tcr(row[c['tcr']].value if c['tcr'] is not None else None),
            'frente': get('frente'), 'periodo': norm_periodo(get('periodo')),
            'curso_idx': norm_curso_idx(get('curso')), 'curso_txt': get('curso').lower(),
        }
        if not b['curso_txt']:
            b['curso_txt'] = DIAS_FULL[b['curso_idx']] if b['curso_idx'] is not None else ''
        elif b['curso_idx'] is not None:
            b['curso_txt'] = DIAS_FULL[b['curso_idx']]
        beneficiarios.append(b)
    return beneficiarios


# ================= montagem do documento multipágina =================
CAMPOS = [  # (valor original no template, chave do beneficiário)
    ('Jennifer Pereira Dos Santos', 'nome'),
    ('Zeladoria', 'projeto'),
    ('Manhã', 'periodo'),
    ('Rua dos Estudantes n° 16 á 86', 'frente'),
    ('quinta-feira', 'curso_txt'),
    ('Sé', 'sub'),
    ('39808371x', 'rg'),
    ('493.596.268-21', 'cpf'),
    ('409736', 'cartao'),
    ('3561', 'agencia'),
    ('01/09/2026', 'tcr'),
]


def corpo_beneficiario(body_tpl, tbl_regexp, b, mes, ano, folga_weekdays, extra_dates, page_break, id_offset):
    """Substitui campos + tabela no corpo do template para um beneficiário."""
    corpo = body_tpl
    # tabela nova
    novo_tbl = tabela_xml(mes, ano, folga_weekdays, extra_dates, b['curso_idx'])
    corpo = tbl_regexp.sub(lambda m: novo_tbl, corpo, count=1)
    # campos
    mes_ext = MESES_PT[mes - 1]
    valores = {k: limpa(b.get(k, '')) for _, k in CAMPOS}
    valores['mês'] = f'{mes_ext}/ {ano}'
    subs = []
    for original, chave in CAMPOS:
        subs.append((original, valores[chave]))
    for original, novo in subs:
        if original == '':
            continue
        pat = re.compile(r'(<w:t[^>]*>)' + re.escape(original) + r'(</w:t>)')
        if not pat.search(corpo):
            raise RuntimeError(f'Valor do template não encontrado: {original!r}')
        novo_esc = escape(novo) if novo else ''
        corpo = pat.sub(lambda m: m.group(1) + novo_esc + m.group(2), corpo, count=1)
    # mês vigente (texto corrido no parágrafo, com espaços ao redor preservados)
    corpo = corpo.replace('outubro/ 2026', escape(valores['mês']))
    # renumera ids de desenhos para evitar duplicação entre páginas
    if id_offset:
        corpo = re.sub(r'(docPr id=")(\d+)', lambda m: m.group(1) + str(int(m.group(2)) + id_offset), corpo)
        corpo = re.sub(r'(o:spid="_x0000_s)(\d+)', lambda m: m.group(1) + str(int(m.group(2)) + id_offset), corpo)
    if page_break:
        corpo += '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="14" w:lineRule="exact"/>' \
                 '<w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr>' \
                 '<w:br w:type="page"/></w:r></w:p>'
    return corpo


def gerar(entrada, saida, mes, ano, folga_weekdays, extra_dates):
    os.makedirs(saida, exist_ok=True)
    beneficiarios = ler_planilha(entrada)
    if not beneficiarios:
        raise ValueError('Nenhum beneficiário encontrado na planilha.')

    zin = zipfile.ZipFile(TEMPLATE)
    xml = zin.read('word/document.xml').decode('utf-8')
    m_body = re.search(r'(<w:body>)(.*)(<w:sectPr)', xml, re.DOTALL)
    if not m_body:
        raise RuntimeError('Estrutura do template inesperada (body).')
    # corpo sem a última quebra? mantém tudo entre <w:body> e <w:sectPr
    body_tpl = m_body.group(2)
    tbl_re = re.compile(r'<w:tbl>.*</w:tbl>', re.DOTALL)
    assert tbl_re.search(body_tpl), 'Tabela não encontrada no template'

    partes = []
    for i, b in enumerate(beneficiarios):
        partes.append(corpo_beneficiario(body_tpl, tbl_re, b, mes, ano,
                                         folga_weekdays, extra_dates,
                                         page_break=(i < len(beneficiarios) - 1),
                                         id_offset=i * 5000))
    new_xml = xml[:m_body.start(2)] + ''.join(partes) + xml[m_body.end(2):]

    docx_path = os.path.join(saida, '_lote.docx')
    with zipfile.ZipFile(docx_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.namelist():
            data = zin.read(item)
            if item == 'word/document.xml':
                data = new_xml.encode('utf-8')
            zout.writestr(item, data)

    # converte para PDF (uma única conversão do lote) — SOFFICE_BIN permite apontar outro caminho
    soffice = os.environ.get('SOFFICE_BIN', 'soffice')
    subprocess.run([soffice, '--headless', '--convert-to', 'pdf', '--outdir', saida, docx_path],
                   check=True, capture_output=True, timeout=600)
    pdf_lote = os.path.join(saida, '_lote.pdf')
    reader = PdfReader(pdf_lote)
    if len(reader.pages) != len(beneficiarios):
        raise RuntimeError(f'Número de páginas ({len(reader.pages)}) difere de beneficiários ({len(beneficiarios)}).')

    # divide em PDFs individuais
    usados = set()
    arquivos = []
    for i, b in enumerate(beneficiarios):
        w = PdfWriter()
        w.add_page(reader.pages[i])
        base = nome_arquivo(b['cartao'], b['nome'])
        nome = f'{base}.pdf'
        k = 2
        while nome in usados:
            nome = f'{base}_{k}.pdf'
            k += 1
        usados.add(nome)
        with open(os.path.join(saida, nome), 'wb') as f:
            w.write(f)
        arquivos.append(nome)

    # prévia da 1ª folha
    subprocess.run(['pdftoppm', '-png', '-r', '110', '-f', '1', '-l', '1', '-singlefile',
                    pdf_lote, os.path.join(saida, 'preview_folha_1')], check=True, timeout=120)

    # zip
    zip_path = os.path.join(saida, 'folhas_ponto.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for nome in arquivos:
            z.write(os.path.join(saida, nome), nome)

    resumo = {
        'ok': True,
        'mes': mes, 'ano': ano,
        'mes_vigente': f'{MESES_PT[mes-1]}/ {ano}',
        'total': len(beneficiarios),
        'arquivos': arquivos,
        'zip': 'folhas_ponto.zip',
        'preview': 'preview_folha_1.png',
        'primeiro': beneficiarios[0]['nome'],
    }
    with open(os.path.join(saida, 'resumo.json'), 'w', encoding='utf-8') as f:
        json.dump(resumo, f, ensure_ascii=False, indent=2)
    # limpeza
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
    ap.add_argument('--mes', type=int, required=True)
    ap.add_argument('--ano', type=int, required=True)
    ap.add_argument('--folgas', default='1,2', help='índices 0=Dom..6=Sab separados por vírgula')
    ap.add_argument('--extra', default='', help='datas extras de folga AAAA-MM-DD separadas por vírgula')
    args = ap.parse_args()
    folgas = set(int(x) for x in args.folgas.split(',') if x.strip() != '')
    extras = set()
    for s in args.extra.split(','):
        s = s.strip()
        if s:
            extras.add(datetime.date.fromisoformat(s))
    res = gerar(args.entrada, args.saida, args.mes, args.ano, folgas, extras)
    print(json.dumps(res, ensure_ascii=False, indent=2))

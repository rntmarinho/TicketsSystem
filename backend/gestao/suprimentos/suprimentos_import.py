"""
Parsing da planilha de solicitações de compra (exportação do ERP Senior) —
isolado da lógica de CRUD/merge, que fica em suprimentos_service.py.
"""
import io
import zipfile
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
import openpyxl
from gestao.models.suprimentos_models import (
    PLANILHA_COLUNAS, PLANILHA_COLUNAS_NUMERICAS, PLANILHA_COLUNAS_DATA, PLANILHA_COLUNAS_ANCORA,
)

# Placeholder literal usado pelo ERP pra "data vazia" — não é um erro de
# formatação, é o valor real gravado quando o campo não foi preenchido.
DATA_VAZIA = "00/00/0000"

# xl/styles.xml mínimo e válido — usado pra substituir o styles.xml original
# do arquivo antes de abrir com openpyxl (ver _sanitized_stream abaixo).
_MINIMAL_STYLES_XML = (
    b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    b'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    b'<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
    b'<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
    b'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    b'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    b'<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
    b'</styleSheet>'
)


def _sanitized_stream(file_storage):
    """
    Alguns relatórios exportados do ERP Senior têm dois defeitos fora do
    schema OOXML: (1) xl/styles.xml com atributos left/right/top/bottom
    direto na tag <border>, em vez dos elementos filhos exigidos — o
    openpyxl trava tentando ler esse styles.xml (TypeError em Border.left);
    (2) os nomes internos do zip usam barra invertida ("xl\\workbook.xml")
    em vez da barra normal exigida pelo padrão ("xl/workbook.xml") — o
    openpyxl procura pelo nome com barra normal e não encontra ("no item
    named 'xl/workbook.xml'"). Como a importação só precisa dos valores das
    células (nunca da formatação visual), reescrevemos o zip inteiro com
    nomes normalizados e um styles.xml mínimo válido antes de abrir com
    openpyxl — seguro pra qualquer arquivo, não só os malformados.
    """
    file_storage.stream.seek(0)
    original = io.BytesIO(file_storage.read())
    file_storage.stream.seek(0)

    saida = io.BytesIO()
    with zipfile.ZipFile(original) as zin, zipfile.ZipFile(saida, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            nome_normalizado = item.filename.replace("\\", "/")
            conteudo = _MINIMAL_STYLES_XML if nome_normalizado == "xl/styles.xml" else zin.read(item.filename)
            item.filename = nome_normalizado
            zout.writestr(item, conteudo)
    saida.seek(0)
    return saida


def parse_excel_date(raw):
    """
    Converte um valor de célula de data pros três formatos observados nos
    dados reais: número de série do Excel (int/float — sistema de datas
    1900, com o off-by-one de ano bissexto de 1900 já embutido na fórmula
    clássica), o texto literal "00/00/0000" (vazio), ou um date/datetime já
    resolvido pelo openpyxl quando a célula tem formatação de data no Excel.
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        texto = raw.strip()
        if texto == "" or texto == DATA_VAZIA:
            return None
        return None  # texto que não é o placeholder conhecido — não é uma data reconhecível
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    if isinstance(raw, (int, float)):
        return date(1899, 12, 30) + timedelta(days=int(raw))
    return None


def parse_numeric(raw):
    """
    Célula numérica nativa (int/float) do openpyxl já vem sem formatação —
    Decimal(str(raw)) sempre usa ponto como decimal, então funciona direto.
    Mas quando a célula (ou o valor digitado à mão na tela, ver
    suprimentos_service.py::update_item) é texto formatado em pt-BR (vírgula
    decimal, ponto de milhar — ex.: "1,000" grafado assim mesmo significando
    1, ou "1.234,567"), Decimal(str(raw)) direto falhava silenciosamente
    (retornava None) ou, em outros casos, tratava a vírgula como separador de
    milhar trocado — achado real, 25/08: quantidades da planilha vindo
    erradas, e também não dava pra digitar vírgula na tela de edição.
    """
    if raw is None or raw == "":
        return None
    if isinstance(raw, (int, float, Decimal)):
        return Decimal(str(raw))
    texto = str(raw).strip()
    if not texto:
        return None
    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    try:
        return Decimal(texto)
    except (InvalidOperation, ValueError):
        return None


def _parse_text(raw):
    if raw is None:
        return None
    texto = str(raw).strip()
    return texto if texto != "" else None


def parse_workbook(file_storage):
    """
    Lê a primeira planilha do arquivo enviado e devolve (linhas, pulados, erro_cabecalho).
    - linhas: lista de dicts {atributo_do_modelo: valor_convertido}, uma por
      linha de dado válida (pula linhas totalmente vazias silenciosamente).
    - pulados: mensagens sobre linhas com dado mas sem "Solicitação" preenchida
      (não têm chave identificável — não dá pra mesclar nem editar depois).
    - erro_cabecalho: mensagem de erro se o arquivo não tem as colunas-âncora
      esperadas (nesse caso `linhas` vem vazia — nenhuma linha é processada).
    Levanta ValueError se o arquivo não puder nem ser aberto como .xlsx.
    """
    try:
        wb = openpyxl.load_workbook(_sanitized_stream(file_storage), data_only=True, read_only=True)
    except Exception as exc:
        raise ValueError(f"Não foi possível ler o arquivo como planilha Excel (.xlsx): {exc}")

    sheet = wb.worksheets[0]
    rows_iter = sheet.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        return [], [], "Planilha vazia — nenhuma linha de cabeçalho encontrada."

    header = [str(h).strip() if h is not None else "" for h in header_row]
    coluna_por_indice = {i: PLANILHA_COLUNAS[h] for i, h in enumerate(header) if h in PLANILHA_COLUNAS}

    faltando = [c for c in PLANILHA_COLUNAS_ANCORA if c not in header]
    if faltando:
        return [], [], (
            "Arquivo não corresponde ao formato esperado de solicitação de compras "
            f"(colunas obrigatórias ausentes: {', '.join(faltando)})."
        )

    linhas = []
    pulados = []
    for numero_linha, row in enumerate(rows_iter, start=2):
        if row is None or all(v is None for v in row):
            continue

        dados = {}
        for indice, atributo in coluna_por_indice.items():
            valor_bruto = row[indice] if indice < len(row) else None
            if atributo in PLANILHA_COLUNAS_NUMERICAS:
                dados[atributo] = parse_numeric(valor_bruto)
            elif atributo in PLANILHA_COLUNAS_DATA:
                dados[atributo] = parse_excel_date(valor_bruto)
            else:
                dados[atributo] = _parse_text(valor_bruto)

        if not dados.get("solicitacao"):
            pulados.append(f"Linha {numero_linha}: sem número de Solicitação, ignorada.")
            continue

        linhas.append(dados)

    return linhas, pulados, None

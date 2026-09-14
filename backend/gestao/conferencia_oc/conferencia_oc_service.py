"""
Busca Ordens de Compra (E420OCP) ao vivo no Senior e mescla com a situação de
conferência local (Financeiro) — a única coisa que este sistema armazena
sobre a OC é o campo de acompanhamento que o ERP não tem (ver
gestao/models/conferencia_oc_models.py).

Testado ao vivo em 10/09/2026 contra o tenant real (usuário gabriel.faria):
NUMOCP/DATEMI/CODFOR/VLRLIQ/SITOCP/SITAPR/USUGER/USU_DATVECT existem e vêm
populados em toda OC recente — a query de _fetch_ocp_rows() funciona como
está. Cadastro de fornecedores confirmado também: E095FOR
(CODFOR/NOMFOR/SIGUFS), informado por quem conhece o schema deste tenant e
validado com CODFOR reais das OCs de teste (ex.: 617268 -> "MERCADO LIVRE
NEW CLICK" / AM) — ver defaults de FORNECEDOR_TABELA abaixo.

Domínio de valores observado (não documentado em lugar nenhum, e não
confirmado com o time de negócio — mostrado cru na tela até validar):
  - SITOCP: "1" e "9" nas OCs recentes vistas.
  - SITAPR: "APR", "PRE" e "ANA" nas OCs recentes vistas.

Outras suposições ainda não confirmadas:
  - "Valor Aberto": assumido como VLRLIQ (valor líquido da OC) — validar se é
    esse o campo certo ou se precisa descontar o que já foi faturado/pago.
"""
import os

from gestao.models.conferencia_oc_models import ConferenciaOcStatus, CONFERENCIA_OC_SITUACOES
from integrations.senior.senior_client import get_db_info, SeniorClientError

# Sem ROWNUM/TOP/DUAL neste dialeto SQL (ver senior_client.py) — a forma de
# limitar o volume é por faixa de uma coluna numérica de chave, não por data
# (comparação de DATE com literal não é confiável nesse parser).
NUMOCP_JANELA = int(os.getenv("SENIOR_OCP_JANELA", "3000"))

CAMPOS_OCP = ("NUMOCP", "DATEMI", "CODFOR", "VLRLIQ", "SITOCP", "SITAPR", "USUGER", "USU_DATVECT")

# Tabela/colunas do cadastro de fornecedores — confirmadas neste tenant em
# 10/09/2026 (E095FOR). Configurável via env só pra cobrir outro tenant com
# nomes diferentes; deixar vazia desliga a busca (tela mostra só o código).
FORNECEDOR_TABELA = os.getenv("SENIOR_FORNECEDOR_TABELA", "E095FOR")
FORNECEDOR_COL_CODIGO = os.getenv("SENIOR_FORNECEDOR_COL_CODIGO", "CODFOR")
FORNECEDOR_COL_NOME = os.getenv("SENIOR_FORNECEDOR_COL_NOME", "NOMFOR")
FORNECEDOR_COL_UF = os.getenv("SENIOR_FORNECEDOR_COL_UF", "SIGUFS")

# Domínio de SITOCP/SITAPR ainda não confirmado neste tenant — até validar
# com dado real, a tela mostra o código cru em vez de um rótulo (ver
# docstring do módulo).
SITOCP_LABELS = {}
SITAPR_LABELS = {}


def _iso(dt):
    return dt.isoformat() if dt else None


def _rotulo(codigo, mapa):
    codigo = (codigo or "").strip()
    return mapa.get(codigo, codigo) if codigo else None


def _max_numocp():
    linhas = get_db_info("SELECT MAX(NUMOCP) AS MX FROM E420OCP")
    valor = linhas[0].get("MX") if linhas else None
    if not valor:
        raise SeniorClientError("Não foi possível determinar o intervalo de OCs (MAX(NUMOCP) vazio).")
    return int(valor)


def _fetch_ocp_rows():
    piso = max(_max_numocp() - NUMOCP_JANELA, 0)
    sql = f"SELECT {', '.join(CAMPOS_OCP)} FROM E420OCP WHERE NUMOCP >= {piso} ORDER BY NUMOCP DESC"
    return get_db_info(sql)


def _lookup_fornecedores(codigos):
    codigos_validos = sorted({str(int(c)) for c in codigos if str(c or "").strip().isdigit()})
    if not codigos_validos or not FORNECEDOR_TABELA:
        return {}
    sql = (
        f"SELECT {FORNECEDOR_COL_CODIGO} AS CODIGO, {FORNECEDOR_COL_NOME} AS NOME, "
        f"{FORNECEDOR_COL_UF} AS UF FROM {FORNECEDOR_TABELA} "
        f"WHERE {FORNECEDOR_COL_CODIGO} IN ({', '.join(codigos_validos)})"
    )
    try:
        linhas = get_db_info(sql)
    except SeniorClientError:
        return {}
    return {str(int(l["CODIGO"])): l for l in linhas if (l.get("CODIGO") or "").strip().isdigit()}


def _mapear_linha(bruta, fornecedores):
    codigo_fornecedor = (bruta.get("CODFOR") or "").strip()
    forn = fornecedores.get(str(int(codigo_fornecedor))) if codigo_fornecedor.isdigit() else None
    return {
        "numero_oc": (bruta.get("NUMOCP") or "").strip(),
        "situacao": _rotulo(bruta.get("SITOCP"), SITOCP_LABELS),
        "emissao": (bruta.get("DATEMI") or "").strip() or None,
        "numero_fornecedor": codigo_fornecedor or None,
        "fornecedor": (forn or {}).get("NOME"),
        "valor_aberto": (bruta.get("VLRLIQ") or "").strip() or None,
        "uf": (forn or {}).get("UF"),
        "geracao": (bruta.get("USUGER") or "").strip() or None,
        "vencimento_titulo": (bruta.get("USU_DATVECT") or "").strip() or None,
        "situacao_aprovacao": _rotulo(bruta.get("SITAPR"), SITAPR_LABELS),
    }


def listar_ordens(session, busca=None):
    brutas = _fetch_ocp_rows()
    fornecedores = _lookup_fornecedores({b.get("CODFOR") for b in brutas})
    status_rows = {row.numero_oc: row for row in session.query(ConferenciaOcStatus).all()}

    termo = (busca or "").strip()
    resultado = {"NAO_CONFERIDO": [], "CONFERIDO": []}
    for bruta in brutas:
        linha = _mapear_linha(bruta, fornecedores)
        if not linha["numero_oc"]:
            continue
        if termo and termo not in linha["numero_oc"]:
            continue
        registro = status_rows.get(linha["numero_oc"])
        situacao_conferencia = registro.situacao if registro else "NAO_CONFERIDO"
        linha["situacao_conferencia"] = situacao_conferencia
        linha["conferido_em"] = _iso(registro.updated_at) if registro else None
        resultado[situacao_conferencia].append(linha)
    return resultado


def atualizar_situacao(session, numero_oc, nova_situacao, user_id):
    numero_oc = (numero_oc or "").strip()
    if not numero_oc:
        return {"success": False, "message": "Número da OC não informado."}, 400
    if nova_situacao not in CONFERENCIA_OC_SITUACOES:
        return {"success": False, "message": "Situação inválida."}, 422

    registro = session.query(ConferenciaOcStatus).get(numero_oc)
    if registro:
        registro.situacao = nova_situacao
        registro.updated_by = user_id
    else:
        registro = ConferenciaOcStatus(numero_oc=numero_oc, situacao=nova_situacao, updated_by=user_id)
        session.add(registro)
    session.commit()
    return {
        "success": True,
        "numero_oc": numero_oc,
        "situacao": registro.situacao,
        "updated_at": _iso(registro.updated_at),
    }, 200

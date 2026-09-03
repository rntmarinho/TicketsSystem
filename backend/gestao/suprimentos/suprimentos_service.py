from datetime import datetime, timedelta, timezone, date
from sqlalchemy import func
from gestao.models.suprimentos_models import (
    SuprimentosSolicitacao, PLANILHA_COLUNAS, PLANILHA_COLUNAS_NUMERICAS, PLANILHA_COLUNAS_DATA, SUPRIMENTOS_STATUSES,
    SUPRIMENTOS_STATUS_LABELS, CAMPOS_ACOMPANHAMENTO, PRAZO_PADRAO_HORAS,
)
from gestao.models.legacy import LegacyUser, LegacyDepartment
from gestao.suprimentos.suprimentos_import import parse_numeric
from gestao.serializers import user_brief

ATRIBUTOS_PLANILHA = set(PLANILHA_COLUNAS.values())

# Visibilidade da linha: enquanto não tem comprador definido, é do dono
# (quem importou); assim que um comprador é definido/alterado, a linha passa
# a ser dele — some da tela de quem importou (decisão da Renata, 24/08). O
# owner_id em si NUNCA muda (é a chave de mescla da reimportação); só a regra
# de "quem enxerga" muda, via COALESCE(comprador_id, owner_id).
_VISIVEL_PARA = func.coalesce(SuprimentosSolicitacao.comprador_id, SuprimentosSolicitacao.owner_id)


def _iso(dt):
    return dt.isoformat() if dt else None


def _serialize(item):
    data = {
        "id": item.id,
        "owner_id": item.owner_id,
        "prazo": _iso(item.prazo) if item.prazo else None,
        "status": item.status,
        "status_descricao": item.status_descricao,
        "justificativa": item.justificativa,
        "transporte": item.transporte,
        "status_pedido": item.status_pedido,
        "comprador_id": item.comprador_id,
        "created_at": _iso(item.created_at),
        "updated_at": _iso(item.updated_at),
    }
    for atributo in ATRIBUTOS_PLANILHA:
        valor = getattr(item, atributo)
        # Date/Numeric não são serializáveis direto pelo jsonify do Flask em
        # todo caso — normaliza pra string, mesma convenção de _iso() já usada
        # pro resto do módulo de gestão.
        if hasattr(valor, "isoformat"):
            valor = valor.isoformat()
        elif valor is not None and not isinstance(valor, (str, int, float)):
            valor = str(valor)
        data[atributo] = valor
    return data


def serialize_item(session, item):
    data = _serialize(item)
    data["comprador"] = user_brief(session, item.comprador_id)
    return data


def _visible_query(session, user_id, role, owner_id_param=None):
    """Desde 03/09/2026 (decisão da Renata, junto com a importação automática
    do Senior): quem chega aqui já passou por require_department('Suprimentos'),
    e TODO o setor enxerga TODAS as linhas — o filtro por comprador é feito na
    tela. Antes a linha era visível só pro dono/comprador, o que não faz sentido
    com linhas criadas pelo robô (dono = usuário de integração)."""
    query = session.query(SuprimentosSolicitacao)
    if owner_id_param:
        query = query.filter(_VISIVEL_PARA == owner_id_param)
    return query


def list_items(session, user_id, role, owner_id_param=None):
    items = _visible_query(session, user_id, role, owner_id_param).order_by(
        SuprimentosSolicitacao.updated_at.desc()
    ).all()
    return [serialize_item(session, i) for i in items]


def _get_visible(session, user_id, role, item_id):
    """None se não existe ou (existe mas) não é visível pra esse usuário — o
    chamador deve tratar os dois casos como 404, pra não vazar existência de
    linha de outro dono (mesmo padrão de tickets/ticket_routes.py)."""
    item = session.query(SuprimentosSolicitacao).get(item_id)
    # Visibilidade por setor (ver _visible_query) — o require_department da rota
    # já garante que só gente do Suprimentos (ou ADMIN) chega aqui.
    return item


def get_item(session, user_id, role, item_id):
    item = _get_visible(session, user_id, role, item_id)
    if not item:
        return {"success": False, "message": "Linha não encontrada."}, 404
    return serialize_item(session, item), 200


def _registrar_mudanca_status(session, item, user_id, status_novo):
    """Acrescenta uma linha datada ao log de status_descricao — o usuário
    nunca escreve direto nesse campo (decisão da Renata, 24/08), o sistema
    registra sozinho toda vez que o status muda."""
    autor = session.query(LegacyUser).get(user_id)
    nome = autor.name if autor else f"usuário #{user_id}"
    agora = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y %H:%M")
    rotulo_antigo = SUPRIMENTOS_STATUS_LABELS.get(item.status, item.status)
    rotulo_novo = SUPRIMENTOS_STATUS_LABELS.get(status_novo, status_novo)
    linha = f"[{agora}] {nome}: {rotulo_antigo} → {rotulo_novo}"
    item.status_descricao = f"{item.status_descricao}\n{linha}" if item.status_descricao else linha


def update_item(session, user_id, role, item_id, data):
    item = _get_visible(session, user_id, role, item_id)
    if not item:
        return {"success": False, "message": "Linha não encontrada."}, 404

    if "status" in data:
        if data["status"] not in SUPRIMENTOS_STATUSES:
            return {"success": False, "message": "Status inválido."}, 422
        if data["status"] != item.status:
            _registrar_mudanca_status(session, item, user_id, data["status"])
            item.status = data["status"]
    if "prazo" in data:
        item.prazo = data["prazo"]
    if "justificativa" in data:
        item.justificativa = data["justificativa"]
    if "transporte" in data:
        item.transporte = data["transporte"]
    if "status_pedido" in data:
        item.status_pedido = data["status_pedido"]
    if "comprador_id" in data:
        # Definir/trocar o comprador transfere a visibilidade da linha pra
        # ele — ela some da tela de quem está fazendo essa edição agora,
        # a menos que seja ADMIN ou o próprio novo comprador (ver
        # _visible_query/_get_visible, que filtram por comprador_id quando
        # preenchido). owner_id nunca muda — continua sendo a chave de
        # mescla da reimportação.
        item.comprador_id = data["comprador_id"]

    # Campos importados da planilha também são editáveis (corrigir erro de
    # digitação entre importações) — mas nunca id/owner_id/chave de negócio,
    # que só mudam via reimportação (ver suprimentos_import.py).
    campos_protegidos = {"solicitacao", "seq_solicitacao"}
    for atributo in ATRIBUTOS_PLANILHA - campos_protegidos:
        if atributo in data:
            valor = data[atributo]
            # Mesmo parser da importação — aceita vírgula OU ponto como
            # decimal, em vez de confiar que o valor já chegou como número
            # (o front manda string; sem isso, editar manualmente quantidade/
            # preço quebrava ou salvava errado — achado real, 25/08).
            if atributo in PLANILHA_COLUNAS_NUMERICAS:
                valor = parse_numeric(valor)
            setattr(item, atributo, valor)

    session.commit()
    return {"success": True, "item": serialize_item(session, item)}, 200


def delete_item(session, user_id, role, item_id):
    item = _get_visible(session, user_id, role, item_id)
    if not item:
        return {"success": False, "message": "Linha não encontrada."}, 404
    session.delete(item)
    session.commit()
    return {"success": True}, 200


# import_spreadsheet() removida em 03/09/2026: a carga passou a vir do ERP Senior via
# sync_from_erp() (n8n, 1x/dia). suprimentos_import.py continua só pelo parse_numeric.


def list_all_for_report(session, inicio=None, fim=None, centro_custo=None):
    """Visão gerencial: TODAS as linhas (sem filtro de dono/comprador — é
    relatório, não a tela de trabalho), filtradas por data_limite_compra
    quando inicio/fim (date) forem informados, e por centro de custo quando
    informado. O filtro usa a mesma regra de agrupamento do resumo (Descrição
    Centro de Custo, com fallback pro código quando a descrição está vazia —
    ver suprimentos_report_controller.py::_build_summary/por_centro_custo),
    senão o valor escolhido no dropdown do relatório nunca bateria com o dado."""
    query = session.query(SuprimentosSolicitacao)
    if inicio:
        query = query.filter(SuprimentosSolicitacao.data_limite_compra >= inicio)
    if fim:
        query = query.filter(SuprimentosSolicitacao.data_limite_compra <= fim)
    if centro_custo:
        query = query.filter(
            func.coalesce(SuprimentosSolicitacao.descricao_centro_custo, SuprimentosSolicitacao.centro_custo)
            == centro_custo
        )
    return query.order_by(SuprimentosSolicitacao.data_limite_compra.asc().nullslast()).all()


def list_compradores(session, department_name="Suprimentos"):
    dept = session.query(LegacyDepartment).filter(LegacyDepartment.name == department_name).first()
    if not dept:
        return []
    usuarios = session.query(LegacyUser).filter(LegacyUser.department_id == dept.id).order_by(LegacyUser.name).all()
    return [{"id": u.id, "name": u.name} for u in usuarios]


# ── Importação automática a partir do ERP Senior (n8n → POST /gestao/suprimentos/sync) ──
# Decisões da Renata (03/09/2026): traz só as solicitações NÃO COTADAS ATIVAS
# como linhas novas; linhas já existentes (de qualquer dono, inclusive as
# importadas por planilha) têm as colunas do ERP atualizadas; o robô só mexe no
# status de acompanhamento em dois casos — cancelada no ERP → CANCELADO, gerou
# pedido/OC → COMPRADO — registrando no histórico como o usuário de integração.
_SITUACAO_CANCELADA = "Cancelada"


def _coerce_row(dados):
    """Normaliza o payload JSON do n8n pros tipos do modelo: datas ISO → date,
    numéricos via parse_numeric (aceita '9,1492'), texto vazio → None."""
    limpo = {}
    for atributo in ATRIBUTOS_PLANILHA:
        if atributo not in dados:
            continue
        valor = dados[atributo]
        if atributo in PLANILHA_COLUNAS_NUMERICAS:
            limpo[atributo] = parse_numeric(valor)
        elif atributo in PLANILHA_COLUNAS_DATA:
            if isinstance(valor, str) and valor.strip():
                try:
                    limpo[atributo] = date.fromisoformat(valor.strip()[:10])
                except ValueError:
                    limpo[atributo] = None
            else:
                limpo[atributo] = None
        else:
            if valor is None:
                limpo[atributo] = None
            else:
                texto = str(valor).strip()
                limpo[atributo] = texto if texto else None
    return limpo


def sync_from_erp(session, bot_user_id, rows):
    if not isinstance(rows, list):
        return {"success": False, "message": "Payload deve ter a lista 'rows'."}, 400

    inserted = updated = skipped_new = 0
    status_auto = {"CANCELADO": 0, "COMPRADO": 0}
    erros = []
    prazo_padrao = (datetime.now(timezone.utc) + timedelta(hours=PRAZO_PADRAO_HORAS)).date()

    for i, bruto in enumerate(rows):
        dados = _coerce_row(bruto)
        solicitacao = dados.get("solicitacao")
        seq = dados.get("seq_solicitacao")
        if not solicitacao or not seq:
            erros.append(f"Linha {i}: sem solicitacao/seq_solicitacao, ignorada.")
            continue

        erp_cancelada = bool(bruto.get("erp_cancelada"))
        erp_comprada = bool(bruto.get("erp_comprada"))
        erp_nao_cotada_ativa = bool(bruto.get("erp_nao_cotada_ativa"))

        # Chave de negócio GLOBAL (qualquer dono): a unicidade por dono existia pra
        # planilhas paralelas; com visibilidade por setor e um robô alimentando,
        # a mesma solicitação/sequência não pode virar duas linhas.
        existente = (
            session.query(SuprimentosSolicitacao)
            .filter(
                SuprimentosSolicitacao.solicitacao == solicitacao,
                SuprimentosSolicitacao.seq_solicitacao == seq,
            )
            .order_by(SuprimentosSolicitacao.created_at.asc())
            .first()
        )

        if existente:
            for atributo, valor in dados.items():
                setattr(existente, atributo, valor)
            updated += 1
            item = existente
        else:
            if not erp_nao_cotada_ativa:
                skipped_new += 1  # cotada/cancelada/comprada e ainda não acompanhada aqui: não entra
                continue
            item = SuprimentosSolicitacao(owner_id=bot_user_id, prazo=prazo_padrao, **dados)
            session.add(item)
            inserted += 1

        # Status automático — só cancelado e comprado; nunca desfaz um manual.
        if erp_cancelada and item.status != "CANCELADO":
            _registrar_mudanca_status(session, item, bot_user_id, "CANCELADO")
            item.status = "CANCELADO"
            status_auto["CANCELADO"] += 1
        elif erp_comprada and item.status not in ("COMPRADO", "CANCELADO"):
            _registrar_mudanca_status(session, item, bot_user_id, "COMPRADO")
            item.status = "COMPRADO"
            status_auto["COMPRADO"] += 1

    session.commit()
    return {
        "success": True,
        "received": len(rows),
        "inserted": inserted,
        "updated": updated,
        "skipped_not_tracked": skipped_new,
        "status_auto": status_auto,
        "errors": erros[:50],
        "errors_total": len(erros),
    }, 200

import hmac
import os
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import get_user_department_id
from services.rate_limiter import limiter
from gestao.models.legacy import LegacyDepartment, LegacyUser
from gestao.models.attachment_models import Attachment
from gestao.serializers import user_brief
from gestao.audit_log import record as audit_record
from gestao.notify import notify
from finance.models import (
    FinanceDemand, FinanceDemandItem, FinanceCentroCusto, DEMAND_STATUSES,
    OC_SITUACAO_APROVACAO, OC_SITUACAO_FINAL,
)

demand_bp = Blueprint("finance_demand_bp", __name__, url_prefix="/finance/demands")

_DIGITS = re.compile(r"\D+")


def _only_digits(value):
    return _DIGITS.sub("", value or "")


def _is_financeiro(session, user_id, role):
    """ADMIN sempre; senão, só quem tem tbl_users.department_id apontando pro
    setor 'Financeiro' — mesma convenção de require_department (comparação
    normalizada), mas aqui feita inline porque a lista (GET) precisa saber
    isso pra decidir o filtro, não só bloquear a rota."""
    if role == "ADMIN":
        return True
    department_id = get_user_department_id(session, user_id)
    if department_id is None:
        return False
    dept = session.query(LegacyDepartment).get(department_id)
    return bool(dept and dept.name.strip().casefold() == "financeiro")


def _financeiro_user_ids(session):
    """IDs de quem está ativo com tbl_users.department_id apontando pro setor
    'Financeiro' — usado pra notificar o setor inteiro quando chega uma OC
    nova (não usa ADMIN como bypass aqui: notificação é por PERTENCER ao
    setor, diferente de PERMISSÃO de ver/concluir, que ADMIN sempre tem)."""
    financeiro_id = None
    for dept in session.query(LegacyDepartment).all():
        if dept.name and dept.name.strip().casefold() == "financeiro":
            financeiro_id = dept.id
            break
    if financeiro_id is None:
        return []
    rows = (
        session.query(LegacyUser.id)
        .filter(LegacyUser.department_id == financeiro_id, LegacyUser.situation == "A")
        .all()
    )
    return [r[0] for r in rows]


def _centro_custos_descricao(session, codigo):
    centro = session.query(FinanceCentroCusto).get(codigo)
    return centro.descricao if centro else None


def _serialize(session, d):
    itens = [
        {
            "id": i.id,
            "description": i.description,
            "quantity": str(i.quantity),
            "unit_value": str(i.unit_value),
            "total": str(i.quantity * i.unit_value),
        }
        for i in d.items
    ]
    total_geral = sum((i.quantity * i.unit_value for i in d.items), Decimal("0"))
    return {
        "id": d.id,
        "status": d.status,
        "requester": user_brief(session, d.requester_id),
        "resolved_by": user_brief(session, d.resolved_by_id) if d.resolved_by_id else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
        "numero_oc": d.numero_oc,
        "oc_status_codigo": d.oc_status_codigo,
        "oc_status_descricao": d.oc_status_descricao,
        "oc_status_synced_at": d.oc_status_synced_at.isoformat() if d.oc_status_synced_at else None,
        "anexos_count": session.query(Attachment).filter(Attachment.demand_id == d.id).count(),
        "fornecedor": {
            "razao_social": d.fornecedor_razao_social,
            "documento": d.fornecedor_documento,
            "tipo_documento": d.fornecedor_tipo_documento,
            "cep": d.fornecedor_cep,
            "endereco": d.fornecedor_endereco,
            "ie": d.fornecedor_ie,
        },
        "centro_custos": d.centro_custos,
        "centro_custos_descricao": _centro_custos_descricao(session, d.centro_custos),
        "observacao": d.observacao,
        "items": itens,
        "total_geral": str(total_geral),
    }


def _validate_and_build(session, data):
    """Valida o payload de criação; devolve (erro_ou_None, kwargs_pro_FinanceDemand, itens_validados)."""
    razao_social = (data.get("fornecedor_razao_social") or "").strip()
    if len(razao_social) < 2 or len(razao_social) > 200:
        return "Razão social do fornecedor deve ter entre 2 e 200 caracteres.", None, None

    tipo_documento = (data.get("fornecedor_tipo_documento") or "").strip().upper()
    if tipo_documento not in ("CNPJ", "CPF"):
        return "Informe se o documento do fornecedor é CNPJ ou CPF.", None, None

    documento = _only_digits(data.get("fornecedor_documento"))
    tamanho_esperado = 14 if tipo_documento == "CNPJ" else 11
    if len(documento) != tamanho_esperado:
        return f"{tipo_documento} do fornecedor deve ter {tamanho_esperado} dígitos.", None, None

    cep = _only_digits(data.get("fornecedor_cep"))
    if len(cep) != 8:
        return "CEP do fornecedor deve ter 8 dígitos.", None, None

    endereco = (data.get("fornecedor_endereco") or "").strip()
    if len(endereco) < 5 or len(endereco) > 255:
        return "Endereço do fornecedor deve ter entre 5 e 255 caracteres.", None, None

    ie = (data.get("fornecedor_ie") or "").strip() or None  # opcional, "se houver"
    if ie and len(ie) > 30:
        return "Inscrição Estadual do fornecedor é grande demais.", None, None

    centro_custos = (data.get("centro_custos") or "").strip()
    if not centro_custos:
        return "Informe o centro de custos.", None, None
    centro_valido = session.query(FinanceCentroCusto).get(centro_custos)
    if not centro_valido:
        return "Centro de custos inválido — escolha um da lista (só aceita os que permitem rateio no Senior).", None, None

    observacao = (data.get("observacao") or "").strip()
    if len(observacao) < 3:
        return "Observação é obrigatória.", None, None

    itens_raw = data.get("items")
    if not isinstance(itens_raw, list) or len(itens_raw) == 0:
        return "Adicione pelo menos um item à ordem de compra.", None, None

    itens_validados = []
    for idx, item in enumerate(itens_raw, start=1):
        description = (item.get("description") or "").strip()
        if len(description) < 2 or len(description) > 300:
            return f"Item {idx}: descrição deve ter entre 2 e 300 caracteres.", None, None
        try:
            quantity = Decimal(str(item.get("quantity")))
            unit_value = Decimal(str(item.get("unit_value")))
        except (InvalidOperation, TypeError):
            return f"Item {idx}: quantidade e valor unitário precisam ser números.", None, None
        if quantity <= 0:
            return f"Item {idx}: quantidade deve ser maior que zero.", None, None
        if unit_value <= 0:
            return f"Item {idx}: valor unitário deve ser maior que zero.", None, None
        itens_validados.append({"description": description, "quantity": quantity, "unit_value": unit_value, "order": idx})

    kwargs = dict(
        fornecedor_razao_social=razao_social,
        fornecedor_documento=documento,
        fornecedor_tipo_documento=tipo_documento,
        fornecedor_cep=cep,
        fornecedor_endereco=endereco,
        fornecedor_ie=ie,
        centro_custos=centro_custos,
        observacao=observacao,
    )
    return None, kwargs, itens_validados


@demand_bp.route("/", methods=["GET"])
@jwt_required()
def list_demands():
    """Todo mundo enxerga — só as próprias, exceto ADMIN/Financeiro (todas).
    ?status=ABERTA|CONCLUIDA filtra; sem o parâmetro, devolve todo status."""
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        query = session.query(FinanceDemand)
        if not _is_financeiro(session, user_id, role):
            query = query.filter(FinanceDemand.requester_id == user_id)
        status = request.args.get("status")
        if status:
            if status not in DEMAND_STATUSES:
                return jsonify({"success": False, "message": "Status inválido."}), 422
            query = query.filter(FinanceDemand.status == status)
        demands = query.order_by(FinanceDemand.created_at.desc()).all()
        return jsonify([_serialize(session, d) for d in demands]), 200
    finally:
        session.close()


@demand_bp.route("/", methods=["POST"])
@jwt_required()
def create_demand():
    """Solicitação de criação de ordem de compra — autoatendimento puro,
    sempre em nome de quem está autenticado. Exige dados completos do
    fornecedor e ao menos um item da OC."""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    session = SessionLocal()
    try:
        error, kwargs, itens = _validate_and_build(session, data)
        if error:
            return jsonify({"success": False, "message": error}), 422

        demand = FinanceDemand(requester_id=user_id, status="ABERTA", **kwargs)
        session.add(demand)
        session.flush()
        for item in itens:
            session.add(FinanceDemandItem(demand_id=demand.id, **item))
        session.flush()
        audit_record(session, user_id, "criar_solicitacao_oc", "FinanceDemand", demand.id, {
            "fornecedor": kwargs["fornecedor_razao_social"], "itens": len(itens),
        })

        # Avisa todo mundo do setor Financeiro (menos quem abriu, se por acaso
        # for do próprio setor) — mesmo helper notify() já usado por tarefa
        # atribuída/aprovação pendente.
        requester = user_brief(session, user_id)
        requester_name = requester["name"] if requester else "alguém"
        for financeiro_user_id in _financeiro_user_ids(session):
            if financeiro_user_id == user_id:
                continue
            notify(
                session, financeiro_user_id,
                f"Nova solicitação de OC: {kwargs['fornecedor_razao_social']}",
                type="OUTRO",
                body=f"Solicitado por {requester_name}",
                link="/financeiro/abertas",
            )

        session.commit()
        return jsonify({"success": True, "demand": _serialize(session, demand)}), 201
    finally:
        session.close()


@demand_bp.route("/<string:demand_id>/status", methods=["PATCH"])
@jwt_required()
def update_status(demand_id):
    """Concluir (associando o número da OC gerada no Senior) ou reabrir uma
    demanda — só ADMIN/Financeiro. Quem abriu a demanda não pode mudar o
    próprio status (evita "fechar" uma solicitação sem passar pelo setor
    responsável). Concluir sem informar numero_oc não é permitido — a
    conclusão É a associação da OC, não um status solto."""
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        if not _is_financeiro(session, user_id, role):
            return jsonify({"success": False, "message": "Só o Financeiro pode concluir demandas."}), 403

        demand = session.query(FinanceDemand).get(demand_id)
        if not demand:
            return jsonify({"success": False, "message": "Demanda não encontrada."}), 404

        payload = request.get_json() or {}
        status = payload.get("status")
        if status not in DEMAND_STATUSES:
            return jsonify({"success": False, "message": "Status inválido."}), 422

        numero_oc = None
        if status == "CONCLUIDA":
            numero_oc = (payload.get("numero_oc") or "").strip()
            if not numero_oc:
                return jsonify({"success": False, "message": "Informe o número da Ordem de Compra pra concluir."}), 422
            if len(numero_oc) > 30:
                return jsonify({"success": False, "message": "Número da Ordem de Compra é grande demais."}), 422
            # NUMOCP no Senior é sempre numérico (E420OCP) — sem isso o
            # acompanhamento automático de status nunca encontra a OC.
            if not numero_oc.isdigit():
                return jsonify({"success": False, "message": "Número da Ordem de Compra deve conter só números (o número gerado no Senior)."}), 422

        demand.status = status
        demand.numero_oc = numero_oc
        demand.resolved_by_id = user_id if status == "CONCLUIDA" else None
        demand.resolved_at = datetime.now(timezone.utc) if status == "CONCLUIDA" else None
        # Reabrir ou trocar o número invalida qualquer status sincronizado
        # antes — evita mostrar o status de uma OC que não é mais essa.
        demand.oc_status_codigo = None
        demand.oc_status_descricao = None
        demand.oc_status_synced_at = None
        audit_record(session, user_id, "atualizar_status_demanda_financeiro", "FinanceDemand", demand.id, {
            "status": status, "numero_oc": numero_oc,
        })
        session.commit()
        return jsonify({"success": True, "demand": _serialize(session, demand)}), 200
    finally:
        session.close()


def _sync_token_valido():
    esperado = os.getenv("FINANCE_OC_STATUS_SYNC_TOKEN", "")
    recebido = request.headers.get("X-Sync-Token", "")
    return bool(esperado) and hmac.compare_digest(esperado, recebido)


# ── Acompanhamento automático do status da OC no Senior (n8n) ────────────────
# Mesmo padrão de token fixo do finance/centro_custo_routes.py::sync_from_erp
# — quem chama é o n8n (de hora em hora), não uma pessoa. Dois passos porque a
# consulta ao Senior (E420OCP) é por NUMOCP: primeiro perguntamos quais
# números ainda vale a pena checar, depois recebemos o resultado já decodificado.
@demand_bp.route("/oc-status/pendentes", methods=["GET"])
@limiter.limit("60 per hour")
def oc_status_pendentes():
    """Números de OC concluídos cujo status ainda não chegou numa situação
    final (aprovado/reprovado/cancelado) — ou nunca foi sincronizado."""
    if not _sync_token_valido():
        return jsonify({"success": False, "message": "Token de sincronização inválido."}), 403

    session = SessionLocal()
    try:
        query = (
            session.query(FinanceDemand.numero_oc)
            .filter(FinanceDemand.status == "CONCLUIDA")
            .filter(FinanceDemand.numero_oc.isnot(None))
            .filter(FinanceDemand.numero_oc != "")
            .filter(
                (FinanceDemand.oc_status_codigo.is_(None))
                | (~FinanceDemand.oc_status_codigo.in_(OC_SITUACAO_FINAL))
            )
            .distinct()
        )
        numeros = sorted({row[0] for row in query.all() if row[0] and row[0].isdigit()}, key=int)
        return jsonify({"numeros": numeros}), 200
    finally:
        session.close()


@demand_bp.route("/oc-status/sync", methods=["POST"])
@limiter.limit("60 per hour")
def oc_status_sync():
    """Recebe {"rows": [{"numero_oc": "123", "sitapr": "APR"}, ...]} — uma
    linha por NUMOCP encontrado no Senior (E420OCP.SITAPR) — e atualiza todas
    as demandas concluídas com aquele número. `sitapr` fora do domínio
    conhecido é gravado como código cru, sem descrição (não inventamos
    tradução pra código desconhecido)."""
    if not _sync_token_valido():
        return jsonify({"success": False, "message": "Token de sincronização inválido."}), 403

    payload = request.get_json(silent=True) or {}
    rows = payload.get("rows")
    if not isinstance(rows, list):
        return jsonify({"success": False, "message": "Payload deve ter a lista 'rows'."}), 400

    session = SessionLocal()
    try:
        atualizadas = 0
        agora = datetime.now(timezone.utc)
        for row in rows:
            numero_oc = str(row.get("numero_oc") or "").strip()
            sitapr = (row.get("sitapr") or "").strip().upper() or None
            if not numero_oc or not numero_oc.isdigit():
                continue
            demandas = (
                session.query(FinanceDemand)
                .filter(FinanceDemand.status == "CONCLUIDA", FinanceDemand.numero_oc == numero_oc)
                .all()
            )
            for demand in demandas:
                demand.oc_status_codigo = sitapr
                demand.oc_status_descricao = OC_SITUACAO_APROVACAO.get(sitapr) if sitapr else None
                demand.oc_status_synced_at = agora
                atualizadas += 1
        session.commit()
        return jsonify({"success": True, "atualizadas": atualizadas}), 200
    finally:
        session.close()

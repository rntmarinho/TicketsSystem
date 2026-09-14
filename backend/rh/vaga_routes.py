from datetime import datetime, timezone, date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import get_user_department_id
from gestao.models.legacy import LegacyDepartment, LegacyUser
from gestao.serializers import user_brief
from gestao.audit_log import record as audit_record
from gestao.notify import notify
from finance.models import FinanceCentroCusto
from rh.models import (
    VagaSolicitacao, RhAprovadorCentroCusto, VAGA_STATUSES, MOTIVO_ABERTURA, REGIME_CONTRATACAO,
)

vaga_bp = Blueprint("rh_vaga_bp", __name__, url_prefix="/rh/vagas")


def _is_rh(session, user_id, role):
    """ADMIN sempre; senão, só quem tem tbl_users.department_id apontando pro
    setor 'RH' — mesma convenção de _is_financeiro em finance/demand_routes.py."""
    if role == "ADMIN":
        return True
    department_id = get_user_department_id(session, user_id)
    if department_id is None:
        return False
    dept = session.query(LegacyDepartment).get(department_id)
    return bool(dept and dept.name.strip().casefold() == "rh")


def _rh_user_ids(session):
    """IDs de quem está ativo no setor 'RH' — pra notificar o setor inteiro
    quando uma vaga é aprovada e entra na fila deles."""
    rh_id = None
    for dept in session.query(LegacyDepartment).all():
        if dept.name and dept.name.strip().casefold() == "rh":
            rh_id = dept.id
            break
    if rh_id is None:
        return []
    rows = (
        session.query(LegacyUser.id)
        .filter(LegacyUser.department_id == rh_id, LegacyUser.situation == "A")
        .all()
    )
    return [r[0] for r in rows]


def _centro_custo_descricao(session, codigo):
    centro = session.query(FinanceCentroCusto).get(codigo)
    return centro.descricao if centro else None


def _serialize(session, v):
    return {
        "id": v.id,
        "status": v.status,
        "requester": user_brief(session, v.requester_id),
        "aprovador": user_brief(session, v.aprovador_id),
        "decidido_por": user_brief(session, v.decidido_por_id) if v.decidido_por_id else None,
        "decidido_em": v.decidido_em.isoformat() if v.decidido_em else None,
        "comentario_decisao": v.comentario_decisao,
        "criada_no_senior_em": v.criada_no_senior_em.isoformat() if v.criada_no_senior_em else None,
        "referencia_vaga_senior": v.referencia_vaga_senior,

        "motivo_abertura": v.motivo_abertura,
        "motivo_substituicao": v.motivo_substituicao,
        "colaborador_substituido": v.colaborador_substituido,
        "cargo_existente_mec": v.cargo_existente_mec,
        "cargo": v.cargo,
        "data_limite_inicio": v.data_limite_inicio.isoformat() if v.data_limite_inicio else None,
        "responsavel_mobilizacao": v.responsavel_mobilizacao,
        "centro_custo": v.centro_custo,
        "centro_custo_descricao": _centro_custo_descricao(session, v.centro_custo),
        "numero_proposta_licitacao": v.numero_proposta_licitacao,
        "local_trabalho": v.local_trabalho,
        "vaga_sigilosa": v.vaga_sigilosa,
        "vaga_proposta_licitacao": v.vaga_proposta_licitacao,
        "quantidade_vagas": v.quantidade_vagas,
        "candidato_deficiente": v.candidato_deficiente,
        "sexo": v.sexo,
        "salario": str(v.salario) if v.salario is not None else None,
        "regime_contratacao": v.regime_contratacao,
        "regime_contratacao_outro": v.regime_contratacao_outro,
        "jornada_trabalho": v.jornada_trabalho,
        "atividades_principais": v.atividades_principais,
        "escolaridade_formacao": v.escolaridade_formacao,
        "experiencias_habilidades": v.experiencias_habilidades,
        "informacoes_adicionais": v.informacoes_adicionais,
        "necessita_cnh": v.necessita_cnh,
        "categoria_cnh": v.categoria_cnh,
        "beneficios": v.beneficios,

        "created_at": v.created_at.isoformat() if v.created_at else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None,
    }


def _parse_date(raw):
    if not raw:
        return None
    try:
        return date.fromisoformat(str(raw)[:10])
    except ValueError:
        return None


def _validate_and_build(session, data):
    """Valida o payload de criação; devolve (erro_ou_None, kwargs_pro_VagaSolicitacao)."""
    motivo = (data.get("motivo_abertura") or "").strip().upper()
    if motivo not in MOTIVO_ABERTURA:
        return "Informe o motivo de abertura (aumento de quadro ou substituição).", None

    motivo_substituicao = (data.get("motivo_substituicao") or "").strip() or None
    colaborador_substituido = (data.get("colaborador_substituido") or "").strip() or None
    if motivo == "SUBSTITUICAO" and not colaborador_substituido:
        return "Em caso de substituição, informe o nome do colaborador substituído.", None

    cargo = (data.get("cargo") or "").strip()
    if len(cargo) < 2 or len(cargo) > 255:
        return "Cargo deve ter entre 2 e 255 caracteres.", None

    centro_custo = (data.get("centro_custo") or "").strip()
    if not centro_custo:
        return "Informe o centro de custo.", None
    if not session.query(FinanceCentroCusto).get(centro_custo):
        return "Centro de custo inválido — escolha um da lista.", None

    local_trabalho = (data.get("local_trabalho") or "").strip()
    if not local_trabalho:
        return "Informe o local de trabalho.", None

    vaga_proposta_licitacao = bool(data.get("vaga_proposta_licitacao"))
    numero_proposta_licitacao = (data.get("numero_proposta_licitacao") or "").strip() or None
    if vaga_proposta_licitacao and not numero_proposta_licitacao:
        return "Informe o número da Proposta ou Licitação.", None

    try:
        quantidade_vagas = int(data.get("quantidade_vagas") or 1)
    except (TypeError, ValueError):
        return "Número de vagas deve ser um número inteiro.", None
    if quantidade_vagas < 1:
        return "Número de vagas deve ser pelo menos 1.", None

    regime_contratacao = (data.get("regime_contratacao") or "").strip().upper()
    if regime_contratacao not in REGIME_CONTRATACAO:
        return "Informe o regime de contratação.", None
    regime_contratacao_outro = (data.get("regime_contratacao_outro") or "").strip() or None
    if regime_contratacao == "OUTRO" and not regime_contratacao_outro:
        return "Informe qual é o outro regime de contratação.", None

    atividades_principais = (data.get("atividades_principais") or "").strip()
    if len(atividades_principais) < 3:
        return "Descreva as principais atividades a serem exercidas.", None

    necessita_cnh = bool(data.get("necessita_cnh"))
    categoria_cnh = (data.get("categoria_cnh") or "").strip() or None
    if necessita_cnh and not categoria_cnh:
        return "Informe a categoria da CNH exigida.", None

    salario_raw = data.get("salario")
    salario = None
    if salario_raw not in (None, ""):
        try:
            salario = round(float(str(salario_raw).replace(".", "").replace(",", ".")), 2) \
                if isinstance(salario_raw, str) and "," in salario_raw else round(float(salario_raw), 2)
        except (TypeError, ValueError):
            return "Salário deve ser um número.", None

    kwargs = dict(
        motivo_abertura=motivo,
        motivo_substituicao=motivo_substituicao,
        colaborador_substituido=colaborador_substituido,
        cargo_existente_mec=bool(data.get("cargo_existente_mec")),
        cargo=cargo,
        data_limite_inicio=_parse_date(data.get("data_limite_inicio")),
        responsavel_mobilizacao=(data.get("responsavel_mobilizacao") or "").strip() or None,
        centro_custo=centro_custo,
        numero_proposta_licitacao=numero_proposta_licitacao,
        local_trabalho=local_trabalho,
        vaga_sigilosa=bool(data.get("vaga_sigilosa")),
        vaga_proposta_licitacao=vaga_proposta_licitacao,
        quantidade_vagas=quantidade_vagas,
        candidato_deficiente=(data.get("candidato_deficiente") or "").strip() or None,
        sexo=(data.get("sexo") or "").strip() or None,
        salario=salario,
        regime_contratacao=regime_contratacao,
        regime_contratacao_outro=regime_contratacao_outro,
        jornada_trabalho=(data.get("jornada_trabalho") or "").strip() or None,
        atividades_principais=atividades_principais,
        escolaridade_formacao=(data.get("escolaridade_formacao") or "").strip() or None,
        experiencias_habilidades=(data.get("experiencias_habilidades") or "").strip() or None,
        informacoes_adicionais=(data.get("informacoes_adicionais") or "").strip() or None,
        necessita_cnh=necessita_cnh,
        categoria_cnh=categoria_cnh,
        beneficios=(data.get("beneficios") or "").strip() or None,
    )
    return None, kwargs


@vaga_bp.route("/", methods=["GET"])
@jwt_required()
def list_vagas():
    """ADMIN/RH veem todas; quem é aprovador de alguma vaga vê as que
    precisam da sua decisão; o solicitante vê as próprias. ?status= filtra."""
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        query = session.query(VagaSolicitacao)
        if not _is_rh(session, user_id, role):
            query = query.filter(
                (VagaSolicitacao.requester_id == user_id) | (VagaSolicitacao.aprovador_id == user_id)
            )
        status = request.args.get("status")
        if status:
            if status not in VAGA_STATUSES:
                return jsonify({"success": False, "message": "Status inválido."}), 422
            query = query.filter(VagaSolicitacao.status == status)
        vagas = query.order_by(VagaSolicitacao.created_at.desc()).all()
        return jsonify([_serialize(session, v) for v in vagas]), 200
    finally:
        session.close()


@vaga_bp.route("/", methods=["POST"])
@jwt_required()
def create_vaga():
    """Solicitação de abertura de vaga — aberta a qualquer usuário
    autenticado, sempre em nome de quem está logado. O aprovador é resolvido
    automaticamente a partir do centro de custo escolhido; se ninguém foi
    cadastrado como aprovador daquele centro, a criação é recusada."""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    session = SessionLocal()
    try:
        error, kwargs = _validate_and_build(session, data)
        if error:
            return jsonify({"success": False, "message": error}), 422

        mapeamento = session.query(RhAprovadorCentroCusto).get(kwargs["centro_custo"])
        if not mapeamento:
            return jsonify({
                "success": False,
                "message": (
                    "Este centro de custo ainda não tem aprovador cadastrado — "
                    "peça pro administrador configurar em Administração > Aprovadores de Centro de Custo."
                ),
            }), 400

        vaga = VagaSolicitacao(
            requester_id=user_id, aprovador_id=mapeamento.aprovador_id,
            status="PENDENTE_APROVACAO", **kwargs,
        )
        session.add(vaga)
        session.flush()
        audit_record(session, user_id, "criar_solicitacao_vaga", "VagaSolicitacao", vaga.id, {
            "cargo": kwargs["cargo"], "centro_custo": kwargs["centro_custo"],
        })

        requester = user_brief(session, user_id)
        requester_name = requester["name"] if requester else "alguém"
        notify(
            session, mapeamento.aprovador_id,
            f"Nova solicitação de vaga: {kwargs['cargo']}",
            type="OUTRO",
            body=f"Solicitado por {requester_name} — aguardando sua aprovação.",
            link="/rh/aprovacoes",
        )

        session.commit()
        return jsonify({"success": True, "vaga": _serialize(session, vaga)}), 201
    finally:
        session.close()


@vaga_bp.route("/<string:vaga_id>/decisao", methods=["PATCH"])
@jwt_required()
def decidir_vaga(vaga_id):
    """Aprovar ou reprovar — só quem é o aprovador designado daquela vaga,
    ou ADMIN. Transição única: só sai de PENDENTE_APROVACAO."""
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        vaga = session.query(VagaSolicitacao).get(vaga_id)
        if not vaga:
            return jsonify({"success": False, "message": "Solicitação não encontrada."}), 404

        if role != "ADMIN" and vaga.aprovador_id != user_id:
            return jsonify({"success": False, "message": "Só o aprovador designado pode decidir esta solicitação."}), 403

        if vaga.status != "PENDENTE_APROVACAO":
            return jsonify({"success": False, "message": "Esta solicitação já foi decidida."}), 409

        payload = request.get_json() or {}
        decisao = (payload.get("decisao") or "").strip().upper()
        if decisao not in ("APROVADA", "REPROVADA"):
            return jsonify({"success": False, "message": "Decisão deve ser APROVADA ou REPROVADA."}), 422

        comentario = (payload.get("comentario") or "").strip() or None
        if decisao == "REPROVADA" and not comentario:
            return jsonify({"success": False, "message": "Informe um comentário explicando a reprovação."}), 422

        vaga.status = decisao
        vaga.decidido_por_id = user_id
        vaga.decidido_em = datetime.now(timezone.utc)
        vaga.comentario_decisao = comentario

        audit_record(session, user_id, "decidir_solicitacao_vaga", "VagaSolicitacao", vaga.id, {
            "decisao": decisao,
        })

        notify(
            session, vaga.requester_id,
            f"Sua solicitação de vaga ({vaga.cargo}) foi {decisao.lower()}",
            type="OUTRO",
            body=comentario,
            link="/rh/aprovacoes",
        )
        if decisao == "APROVADA":
            for rh_user_id in _rh_user_ids(session):
                notify(
                    session, rh_user_id,
                    f"Vaga aprovada, pronta pro RH: {vaga.cargo}",
                    type="OUTRO",
                    body=f"Centro de custo {vaga.centro_custo}",
                    link="/rh",
                )

        session.commit()
        return jsonify({"success": True, "vaga": _serialize(session, vaga)}), 200
    finally:
        session.close()


@vaga_bp.route("/<string:vaga_id>/marcar-criada", methods=["PATCH"])
@jwt_required()
def marcar_criada(vaga_id):
    """RH marca que criou a vaga de verdade no Senior (manual — sem chamada
    de API nesta v1). Só ADMIN/RH, e só a partir de APROVADA."""
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        if not _is_rh(session, user_id, role):
            return jsonify({"success": False, "message": "Só o RH pode marcar uma vaga como criada."}), 403

        vaga = session.query(VagaSolicitacao).get(vaga_id)
        if not vaga:
            return jsonify({"success": False, "message": "Solicitação não encontrada."}), 404
        if vaga.status != "APROVADA":
            return jsonify({"success": False, "message": "Só é possível marcar como criada uma vaga já aprovada."}), 409

        payload = request.get_json() or {}
        referencia = (payload.get("referencia_vaga_senior") or "").strip() or None

        vaga.status = "VAGA_CRIADA"
        vaga.criada_no_senior_em = datetime.now(timezone.utc)
        vaga.referencia_vaga_senior = referencia

        audit_record(session, user_id, "marcar_vaga_criada_senior", "VagaSolicitacao", vaga.id, {
            "referencia_vaga_senior": referencia,
        })
        session.commit()
        return jsonify({"success": True, "vaga": _serialize(session, vaga)}), 200
    finally:
        session.close()

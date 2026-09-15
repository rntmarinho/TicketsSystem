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
from gestao.models.attachment_models import Attachment
from finance.models import FinanceCentroCusto
from services.email_service import send_vaga_sigilosa_notification
from tickets.ticket_model import TicketModel
from rh.models import (
    VagaSolicitacao, RhAprovadorCentroCusto, VAGA_STATUSES, MOTIVO_ABERTURA, REGIME_CONTRATACAO,
)

# Categoria/prioridade do chamado de TI auto-criado quando a vaga é marcada
# como criada e algum item do checklist de provisionamento foi marcado (ver
# marcar_criada) -- ids confirmados direto em tbl_categories/tbl_priorities.
CATEGORIA_SUPORTE_TI_ID = 22
PRIORIDADE_MEDIA_ID = 2

# Rótulos dos itens do checklist de TI (formulário FOR 12.0.4, parte 2) --
# usados só pra montar a descrição do chamado auto-criado em marcar_criada.
TI_CHECKLIST_BOOL_LABELS = (
    ("ti_mobiliario", "Mobiliário (mesa/cadeira)"),
    ("ti_telefone_celular", "Telefone celular"),
    ("ti_materiais_escritorio", "Materiais de escritório"),
    ("ti_computador", "Computador"),
    ("ti_acesso_pastas_rede", "Acesso a pastas da rede"),
    ("ti_acesso_vpn", "Acesso à VPN"),
    ("ti_conta_email", "Conta de e-mail"),
    ("ti_criacao_assinatura_email", "Criação de assinatura de e-mail"),
    ("ti_acesso_intranet", "Acesso à Intranet"),
    ("ti_senha_telefone_fixo", "Senha de telefone fixo"),
    ("ti_necessidade_art", "Necessidade de ART"),
    ("ti_necessidade_epi", "Necessidade de EPI"),
    ("ti_necessidade_alojamento", "Necessidade de alojamento"),
    ("ti_kit_roupa_cama_banho", "Kit de roupa de cama e banho"),
    ("ti_baixada", "Baixada"),
    ("ti_deslocamento_mensal", "Deslocamento mensal"),
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
        "chamado_ti_id": v.chamado_ti_id,
        "anexos_count": session.query(Attachment).filter(Attachment.vaga_id == v.id).count(),

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

        "ti_mobiliario": v.ti_mobiliario,
        "ti_telefone_celular": v.ti_telefone_celular,
        "ti_materiais_escritorio": v.ti_materiais_escritorio,
        "ti_computador": v.ti_computador,
        "ti_perfil_computador": v.ti_perfil_computador,
        "ti_softwares": v.ti_softwares,
        "ti_outros_softwares": v.ti_outros_softwares,
        "ti_acesso_pastas_rede": v.ti_acesso_pastas_rede,
        "ti_caminho_pastas_rede": v.ti_caminho_pastas_rede,
        "ti_acesso_vpn": v.ti_acesso_vpn,
        "ti_conta_email": v.ti_conta_email,
        "ti_email_substituicao": v.ti_email_substituicao,
        "ti_criacao_assinatura_email": v.ti_criacao_assinatura_email,
        "ti_acesso_intranet": v.ti_acesso_intranet,
        "ti_senha_telefone_fixo": v.ti_senha_telefone_fixo,
        "ti_necessidade_art": v.ti_necessidade_art,
        "ti_necessidade_epi": v.ti_necessidade_epi,
        "ti_necessidade_alojamento": v.ti_necessidade_alojamento,
        "ti_kit_roupa_cama_banho": v.ti_kit_roupa_cama_banho,
        "ti_baixada": v.ti_baixada,
        "ti_periodicidade_baixada": v.ti_periodicidade_baixada,
        "ti_deslocamento_mensal": v.ti_deslocamento_mensal,
        "ti_dias_deslocamento": v.ti_dias_deslocamento,

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

        ti_mobiliario=bool(data.get("ti_mobiliario")),
        ti_telefone_celular=bool(data.get("ti_telefone_celular")),
        ti_materiais_escritorio=bool(data.get("ti_materiais_escritorio")),
        ti_computador=bool(data.get("ti_computador")),
        ti_perfil_computador=(data.get("ti_perfil_computador") or "").strip() or None,
        ti_softwares=(data.get("ti_softwares") or "").strip() or None,
        ti_outros_softwares=(data.get("ti_outros_softwares") or "").strip() or None,
        ti_acesso_pastas_rede=bool(data.get("ti_acesso_pastas_rede")),
        ti_caminho_pastas_rede=(data.get("ti_caminho_pastas_rede") or "").strip() or None,
        ti_acesso_vpn=bool(data.get("ti_acesso_vpn")),
        ti_conta_email=bool(data.get("ti_conta_email")),
        ti_email_substituicao=(data.get("ti_email_substituicao") or "").strip() or None,
        ti_criacao_assinatura_email=bool(data.get("ti_criacao_assinatura_email")),
        ti_acesso_intranet=bool(data.get("ti_acesso_intranet")),
        ti_senha_telefone_fixo=bool(data.get("ti_senha_telefone_fixo")),
        ti_necessidade_art=bool(data.get("ti_necessidade_art")),
        ti_necessidade_epi=bool(data.get("ti_necessidade_epi")),
        ti_necessidade_alojamento=bool(data.get("ti_necessidade_alojamento")),
        ti_kit_roupa_cama_banho=bool(data.get("ti_kit_roupa_cama_banho")),
        ti_baixada=bool(data.get("ti_baixada")),
        ti_periodicidade_baixada=(data.get("ti_periodicidade_baixada") or "").strip() or None,
        ti_deslocamento_mensal=bool(data.get("ti_deslocamento_mensal")),
        ti_dias_deslocamento=(data.get("ti_dias_deslocamento") or "").strip() or None,
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

        if vaga.vaga_sigilosa:
            send_vaga_sigilosa_notification(
                vaga.cargo, _centro_custo_descricao(session, vaga.centro_custo), requester_name,
            )

        return jsonify({"success": True, "vaga": _serialize(session, vaga)}), 201
    finally:
        session.close()


@vaga_bp.route("/<string:vaga_id>", methods=["GET"])
@jwt_required()
def get_vaga(vaga_id):
    """Busca uma solicitação — mesma regra de visibilidade de list_vagas,
    aplicada a uma linha só (usada pela tela de edição)."""
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        vaga = session.query(VagaSolicitacao).get(vaga_id)
        if not vaga:
            return jsonify({"success": False, "message": "Solicitação não encontrada."}), 404
        pode_ver = _is_rh(session, user_id, role) or vaga.requester_id == user_id or vaga.aprovador_id == user_id
        if not pode_ver:
            return jsonify({"success": False, "message": "Solicitação não encontrada."}), 404
        return jsonify(_serialize(session, vaga)), 200
    finally:
        session.close()


@vaga_bp.route("/<string:vaga_id>", methods=["PATCH"])
@jwt_required()
def update_vaga(vaga_id):
    """Editar os dados da solicitação — só quem abriu (ou ADMIN), e só
    enquanto ainda não foi decidida. Trocar o centro de custo aqui resolve o
    aprovador de novo (mesma regra da criação) -- pode mudar quem vai
    decidir, então avisa o novo aprovador como se fosse uma criação."""
    user_id = int(get_jwt_identity())
    role = get_current_role()
    data = request.get_json() or {}

    session = SessionLocal()
    try:
        vaga = session.query(VagaSolicitacao).get(vaga_id)
        if not vaga:
            return jsonify({"success": False, "message": "Solicitação não encontrada."}), 404
        if role != "ADMIN" and vaga.requester_id != user_id:
            return jsonify({"success": False, "message": "Só quem abriu a solicitação pode editá-la."}), 403
        if vaga.status != "PENDENTE_APROVACAO":
            return jsonify({"success": False, "message": "Só é possível editar enquanto pendente de aprovação."}), 409

        error, kwargs = _validate_and_build(session, data)
        if error:
            return jsonify({"success": False, "message": error}), 422

        centro_custo_mudou = kwargs["centro_custo"] != vaga.centro_custo
        if centro_custo_mudou:
            mapeamento = session.query(RhAprovadorCentroCusto).get(kwargs["centro_custo"])
            if not mapeamento:
                return jsonify({
                    "success": False,
                    "message": (
                        "Este centro de custo ainda não tem aprovador cadastrado — "
                        "peça pro administrador configurar em Administração > Aprovadores de Centro de Custo."
                    ),
                }), 400
            vaga.aprovador_id = mapeamento.aprovador_id

        for campo, valor in kwargs.items():
            setattr(vaga, campo, valor)

        audit_record(session, user_id, "editar_solicitacao_vaga", "VagaSolicitacao", vaga.id, {
            "centro_custo_mudou": centro_custo_mudou,
        })

        if centro_custo_mudou:
            requester = user_brief(session, vaga.requester_id)
            notify(
                session, vaga.aprovador_id,
                f"Solicitação de vaga editada, aguardando sua aprovação: {vaga.cargo}",
                type="OUTRO",
                body=f"Solicitado por {requester['name'] if requester else 'alguém'}",
                link="/rh/aprovacoes",
            )

        session.commit()
        return jsonify({"success": True, "vaga": _serialize(session, vaga)}), 200
    finally:
        session.close()


@vaga_bp.route("/<string:vaga_id>/cancelar", methods=["PATCH"])
@jwt_required()
def cancelar_vaga(vaga_id):
    """Só quem abriu (ou ADMIN) pode cancelar, e só enquanto pendente --
    depois de decidida (aprovada/reprovada) é histórico de uma decisão já
    tomada por outra pessoa, não dá pra desfazer por aqui."""
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        vaga = session.query(VagaSolicitacao).get(vaga_id)
        if not vaga:
            return jsonify({"success": False, "message": "Solicitação não encontrada."}), 404
        if role != "ADMIN" and vaga.requester_id != user_id:
            return jsonify({"success": False, "message": "Só quem abriu a solicitação pode cancelá-la."}), 403
        if vaga.status != "PENDENTE_APROVACAO":
            return jsonify({"success": False, "message": "Só é possível cancelar enquanto pendente de aprovação."}), 409

        vaga.status = "CANCELADA"
        audit_record(session, user_id, "cancelar_solicitacao_vaga", "VagaSolicitacao", vaga.id, {})
        session.commit()
        return jsonify({"success": True, "vaga": _serialize(session, vaga)}), 200
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

        chamado_id = _abrir_chamado_ti_se_necessario(session, vaga)
        if chamado_id:
            vaga.chamado_ti_id = chamado_id

        audit_record(session, user_id, "marcar_vaga_criada_senior", "VagaSolicitacao", vaga.id, {
            "referencia_vaga_senior": referencia, "chamado_ti_id": chamado_id,
        })
        session.commit()
        return jsonify({"success": True, "vaga": _serialize(session, vaga)}), 200
    finally:
        session.close()


def _abrir_chamado_ti_se_necessario(session, vaga):
    """Abre um chamado normal (categoria "Suporte de TI") com o resumo do
    checklist de provisionamento (formulário FOR 12.0.4, parte 2) -- só se
    algum item foi marcado. dono do chamado é quem solicitou a vaga (foi
    quem preencheu o checklist); devolve o id do chamado criado, ou None se
    não havia nada marcado."""
    itens_marcados = [rotulo for campo, rotulo in TI_CHECKLIST_BOOL_LABELS if getattr(vaga, campo)]
    if not itens_marcados:
        return None

    linhas = [f"Provisionamento de TI para a vaga: {vaga.cargo}", ""]
    linhas.append("Itens solicitados:")
    linhas.extend(f"- {rotulo}" for rotulo in itens_marcados)

    detalhes = []
    if vaga.ti_perfil_computador:
        detalhes.append(f"Perfil do computador: {vaga.ti_perfil_computador}")
    if vaga.ti_softwares:
        detalhes.append(f"Softwares: {vaga.ti_softwares}")
    if vaga.ti_outros_softwares:
        detalhes.append(f"Outros softwares: {vaga.ti_outros_softwares}")
    if vaga.ti_caminho_pastas_rede:
        detalhes.append(f"Pastas de rede: {vaga.ti_caminho_pastas_rede}")
    if vaga.ti_email_substituicao:
        detalhes.append(f"E-mail (substituição): {vaga.ti_email_substituicao}")
    if vaga.ti_periodicidade_baixada:
        detalhes.append(f"Periodicidade de baixada: {vaga.ti_periodicidade_baixada}")
    if vaga.ti_dias_deslocamento:
        detalhes.append(f"Dias de deslocamento: {vaga.ti_dias_deslocamento}")
    if vaga.data_limite_inicio:
        detalhes.append(f"Data limite pra início na empresa: {vaga.data_limite_inicio.isoformat()}")
    if detalhes:
        linhas.append("")
        linhas.append("Detalhes:")
        linhas.extend(f"- {d}" for d in detalhes)

    ticket_id = TicketModel.create({
        "subject": f"Provisionamento de TI — {vaga.cargo}",
        "category_id": CATEGORIA_SUPORTE_TI_ID,
        "user_id": vaga.requester_id,
        "priority_id": PRIORIDADE_MEDIA_ID,
        "description": "\n".join(linhas),
    })
    return ticket_id

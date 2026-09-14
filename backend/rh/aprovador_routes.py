from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import require_role
from gestao.serializers import user_brief
from gestao.audit_log import record as audit_record
from finance.models import FinanceCentroCusto
from rh.models import RhAprovadorCentroCusto

# Cadastro de "quem aprova vaga de qual centro de custo" — só ADMIN mexe
# (mesmo padrão de outras telas administrativas, ex: settings/email). Achado
# real, 14/09/2026: não existe essa informação pronta em nenhuma tabela da
# Senior já validada (E044CCU.CODUSU está zerado em todo mundo), então isso
# precisa ser mantido à mão aqui.
aprovador_bp = Blueprint("rh_aprovador_bp", __name__, url_prefix="/rh/aprovadores-centro-custo")


def _serialize(session, m):
    return {
        "centro_custo": m.centro_custo,
        "centro_custo_descricao": (
            session.query(FinanceCentroCusto).get(m.centro_custo).descricao
            if session.query(FinanceCentroCusto).get(m.centro_custo) else None
        ),
        "aprovador": user_brief(session, m.aprovador_id),
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@aprovador_bp.route("/", methods=["GET"])
@require_role("ADMIN")
def list_aprovadores():
    session = SessionLocal()
    try:
        mapeamentos = session.query(RhAprovadorCentroCusto).all()
        return jsonify([_serialize(session, m) for m in mapeamentos]), 200
    finally:
        session.close()


@aprovador_bp.route("/<string:centro_custo>", methods=["PUT"])
@require_role("ADMIN")
def set_aprovador(centro_custo):
    user_id = int(get_jwt_identity())
    session = SessionLocal()
    try:
        if not session.query(FinanceCentroCusto).get(centro_custo):
            return jsonify({"success": False, "message": "Centro de custo inválido."}), 422

        payload = request.get_json() or {}
        try:
            aprovador_id = int(payload.get("aprovador_id"))
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Informe o aprovador."}), 422

        mapeamento = session.query(RhAprovadorCentroCusto).get(centro_custo)
        if mapeamento:
            mapeamento.aprovador_id = aprovador_id
        else:
            mapeamento = RhAprovadorCentroCusto(centro_custo=centro_custo, aprovador_id=aprovador_id)
            session.add(mapeamento)

        audit_record(session, user_id, "definir_aprovador_centro_custo", "RhAprovadorCentroCusto", centro_custo, {
            "aprovador_id": aprovador_id,
        })
        session.commit()
        return jsonify({"success": True, "mapeamento": _serialize(session, mapeamento)}), 200
    finally:
        session.close()


@aprovador_bp.route("/<string:centro_custo>", methods=["DELETE"])
@require_role("ADMIN")
def delete_aprovador(centro_custo):
    user_id = int(get_jwt_identity())
    session = SessionLocal()
    try:
        mapeamento = session.query(RhAprovadorCentroCusto).get(centro_custo)
        if not mapeamento:
            return jsonify({"success": False, "message": "Não há aprovador cadastrado para esse centro de custo."}), 404
        session.delete(mapeamento)
        audit_record(session, user_id, "remover_aprovador_centro_custo", "RhAprovadorCentroCusto", centro_custo, {})
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from database.gestao_db import SessionLocal
from services.department_access import require_department
from gestao.conferencia_oc import conferencia_oc_service
from integrations.senior.senior_client import SeniorClientError

conferencia_oc_bp = Blueprint(
    "financeiro_conferencia_oc_bp", __name__, url_prefix="/financeiro/conferencia-oc"
)


@conferencia_oc_bp.route("/", methods=["GET"])
@require_department("Financeiro")
def listar():
    session = SessionLocal()
    try:
        resultado = conferencia_oc_service.listar_ordens(session, request.args.get("busca"))
        return jsonify({"success": True, **resultado}), 200
    except SeniorClientError as exc:
        return jsonify({"success": False, "message": str(exc)}), 502
    finally:
        session.close()


@conferencia_oc_bp.route("/<string:numero_oc>", methods=["PATCH"])
@require_department("Financeiro")
def atualizar(numero_oc):
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    session = SessionLocal()
    try:
        response, status = conferencia_oc_service.atualizar_situacao(
            session, numero_oc, data.get("situacao"), user_id
        )
        return jsonify(response), status
    finally:
        session.close()

from datetime import date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.department_access import require_department
from gestao.models.suprimentos_models import PLANILHA_COLUNAS_DATA
from gestao.suprimentos import suprimentos_service

suprimentos_bp = Blueprint("gestao_suprimentos_bp", __name__, url_prefix="/gestao/suprimentos")

DATE_FIELDS = ("prazo",) + tuple(PLANILHA_COLUNAS_DATA)


def _parse_date_fields(data):
    """Converte string ISO ('2026-09-01') nos campos de data do payload JSON
    pra date — mesma ideia de gestao/utils.py::parse_datetime_fields, mas
    pra colunas Date (não DateTime)."""
    for campo in DATE_FIELDS:
        if campo in data and data[campo]:
            valor = data[campo]
            data[campo] = date.fromisoformat(valor) if isinstance(valor, str) else valor
        elif campo in data:
            data[campo] = None
    return data


def _guard():
    """require_department() já validou o JWT e barrou a rota se o
    papel/departamento não autoriza — aqui só extraímos identidade/papel
    pra passar aos services (mesmo padrão de get_current_role() usado por
    require_role, que também substitui o @jwt_required() da rota)."""
    return int(get_jwt_identity()), get_current_role()


@suprimentos_bp.route("/import", methods=["POST"])
@require_department("Suprimentos")
def import_spreadsheet():
    user_id, role = _guard()
    if "arquivo" not in request.files:
        return jsonify({"success": False, "message": "Campo 'arquivo' ausente."}), 400
    session = SessionLocal()
    try:
        response, status = suprimentos_service.import_spreadsheet(session, user_id, request.files["arquivo"])
        return jsonify(response), status
    finally:
        session.close()


@suprimentos_bp.route("/", methods=["GET"])
@require_department("Suprimentos")
def list_items():
    user_id, role = _guard()
    session = SessionLocal()
    try:
        owner_id_param = request.args.get("owner_id")
        result = suprimentos_service.list_items(
            session, user_id, role, int(owner_id_param) if owner_id_param else None
        )
        return jsonify(result), 200
    finally:
        session.close()


@suprimentos_bp.route("/compradores", methods=["GET"])
@require_department("Suprimentos")
def list_compradores():
    session = SessionLocal()
    try:
        return jsonify(suprimentos_service.list_compradores(session)), 200
    finally:
        session.close()


@suprimentos_bp.route("/<string:item_id>", methods=["GET"])
@require_department("Suprimentos")
def get_item(item_id):
    user_id, role = _guard()
    session = SessionLocal()
    try:
        response, status = suprimentos_service.get_item(session, user_id, role, item_id)
        return jsonify(response), status
    finally:
        session.close()


@suprimentos_bp.route("/<string:item_id>", methods=["PATCH"])
@require_department("Suprimentos")
def update_item(item_id):
    user_id, role = _guard()
    data = _parse_date_fields(request.get_json() or {})
    session = SessionLocal()
    try:
        response, status = suprimentos_service.update_item(session, user_id, role, item_id, data)
        return jsonify(response), status
    finally:
        session.close()


@suprimentos_bp.route("/<string:item_id>", methods=["DELETE"])
@require_department("Suprimentos")
def delete_item(item_id):
    user_id, role = _guard()
    session = SessionLocal()
    try:
        response, status = suprimentos_service.delete_item(session, user_id, role, item_id)
        return jsonify(response), status
    finally:
        session.close()

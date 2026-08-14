from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao
from gestao.fields import field_service

field_bp = Blueprint("gestao_field_bp", __name__, url_prefix="/gestao")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


@field_bp.route("/projects/<string:project_id>/fields", methods=["GET"])
@jwt_required()
def list_fields(project_id):
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        result, status = field_service.list_fields(session, project_id)
        return jsonify(result), status
    finally:
        session.close()


@field_bp.route("/projects/<string:project_id>/fields", methods=["POST"])
@jwt_required()
def create_field(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    data = request.get_json() or {}
    session = SessionLocal()
    try:
        response, status = field_service.create_field(session, user_id, role, project_id, data)
        return jsonify(response), status
    finally:
        session.close()


@field_bp.route("/fields/<string:field_id>", methods=["PATCH"])
@jwt_required()
def update_field(field_id):
    user_id, role, err = _guard()
    if err:
        return err
    data = request.get_json() or {}
    session = SessionLocal()
    try:
        response, status = field_service.update_field(session, user_id, role, field_id, data)
        return jsonify(response), status
    finally:
        session.close()


@field_bp.route("/fields/<string:field_id>", methods=["DELETE"])
@jwt_required()
def delete_field(field_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = field_service.delete_field(session, user_id, role, field_id)
        return jsonify(response), status
    finally:
        session.close()

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao
from gestao.folders import folder_service

folder_bp = Blueprint("gestao_folder_bp", __name__, url_prefix="/gestao")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


@folder_bp.route("/projects/<string:project_id>/folders", methods=["GET"])
@jwt_required()
def list_folders(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        result, status = folder_service.list_folders(session, user_id, role, project_id)
        return jsonify(result), status
    finally:
        session.close()


@folder_bp.route("/projects/<string:project_id>/folders", methods=["POST"])
@jwt_required()
def create_folder(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    data = request.get_json() or {}
    session = SessionLocal()
    try:
        response, status = folder_service.create_folder(session, user_id, role, project_id, data)
        return jsonify(response), status
    finally:
        session.close()


@folder_bp.route("/folders/<string:folder_id>", methods=["DELETE"])
@jwt_required()
def delete_folder(folder_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = folder_service.delete_folder(session, user_id, role, folder_id)
        return jsonify(response), status
    finally:
        session.close()

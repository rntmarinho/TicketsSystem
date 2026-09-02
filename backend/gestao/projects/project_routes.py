from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao
from gestao.utils import parse_datetime_fields
from gestao.projects import project_service

project_bp = Blueprint("gestao_project_bp", __name__, url_prefix="/gestao/projects")

DATE_FIELDS = ("start_date", "end_date")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


@project_bp.route("/", methods=["GET"])
@jwt_required()
def list_projects():
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        return jsonify(project_service.list_projects(session, user_id, role)), 200
    finally:
        session.close()


@project_bp.route("/", methods=["POST"])
@jwt_required()
def create_project():
    user_id, role, err = _guard()
    if err:
        return err
    data = parse_datetime_fields(request.get_json() or {}, DATE_FIELDS)
    session = SessionLocal()
    try:
        response, status = project_service.create_project(session, user_id, role, data)
        return jsonify(response), status
    finally:
        session.close()


@project_bp.route("/<string:project_id>", methods=["GET"])
@jwt_required()
def get_project(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = project_service.get_project(session, user_id, role, project_id)
        return jsonify(response), status
    finally:
        session.close()


@project_bp.route("/<string:project_id>", methods=["PATCH"])
@jwt_required()
def update_project(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    data = parse_datetime_fields(request.get_json() or {}, DATE_FIELDS)
    session = SessionLocal()
    try:
        response, status = project_service.update_project(session, user_id, role, project_id, data)
        return jsonify(response), status
    finally:
        session.close()


@project_bp.route("/<string:project_id>", methods=["DELETE"])
@jwt_required()
def delete_project(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = project_service.delete_project(session, user_id, role, project_id)
        return jsonify(response), status
    finally:
        session.close()


@project_bp.route("/<string:project_id>/board", methods=["GET"])
@jwt_required()
def get_board(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = project_service.get_board(session, user_id, role, project_id)
        return jsonify(response), status
    finally:
        session.close()


@project_bp.route("/<string:project_id>/board", methods=["PUT"])
@jwt_required()
def update_board(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    content = (request.get_json() or {}).get("content", "")
    session = SessionLocal()
    try:
        response, status = project_service.update_board(session, user_id, role, project_id, content)
        return jsonify(response), status
    finally:
        session.close()


@project_bp.route("/<string:project_id>/clients", methods=["GET"])
@jwt_required()
def list_project_clients(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        result, status = project_service.list_project_clients(session, user_id, role, project_id)
        return jsonify(result), status
    finally:
        session.close()


@project_bp.route("/<string:project_id>/clients", methods=["POST"])
@jwt_required()
def add_project_client(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    client_user_id = (request.get_json() or {}).get("user_id")
    session = SessionLocal()
    try:
        response, status = project_service.add_project_client(session, user_id, role, project_id, client_user_id)
        return jsonify(response), status
    finally:
        session.close()


@project_bp.route("/<string:project_id>/clients/<int:client_user_id>", methods=["DELETE"])
@jwt_required()
def remove_project_client(project_id, client_user_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = project_service.remove_project_client(session, user_id, role, project_id, client_user_id)
        return jsonify(response), status
    finally:
        session.close()

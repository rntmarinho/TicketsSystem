from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao
from gestao.utils import parse_datetime_fields
from gestao.tasks import task_service

task_bp = Blueprint("gestao_task_bp", __name__, url_prefix="/gestao/tasks")

DATE_FIELDS = ("start_date", "due_date", "rotina_ate_data")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


@task_bp.route("/", methods=["GET"])
@jwt_required()
def list_tasks():
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        result = task_service.list_tasks(
            session, user_id, role,
            project_id=request.args.get("project_id"),
            assignee_id=request.args.get("assignee_id"),
            only_top_level=request.args.get("top_level") == "true",
        )
        return jsonify(result), 200
    finally:
        session.close()


@task_bp.route("/", methods=["POST"])
@jwt_required()
def create_task():
    user_id, role, err = _guard()
    if err:
        return err
    data = parse_datetime_fields(request.get_json() or {}, DATE_FIELDS)
    session = SessionLocal()
    try:
        response, status = task_service.create_task(session, user_id, role, data)
        return jsonify(response), status
    finally:
        session.close()


@task_bp.route("/<string:task_id>", methods=["GET"])
@jwt_required()
def get_task(task_id):
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = task_service.get_task(session, task_id)
        return jsonify(response), status
    finally:
        session.close()


@task_bp.route("/<string:task_id>", methods=["PATCH"])
@jwt_required()
def update_task(task_id):
    user_id, role, err = _guard()
    if err:
        return err
    data = parse_datetime_fields(request.get_json() or {}, DATE_FIELDS)
    session = SessionLocal()
    try:
        response, status = task_service.update_task(session, user_id, role, task_id, data)
        return jsonify(response), status
    finally:
        session.close()


@task_bp.route("/<string:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    _, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = task_service.delete_task(session, role, task_id)
        return jsonify(response), status
    finally:
        session.close()


@task_bp.route("/<string:task_id>/move", methods=["POST"])
@jwt_required()
def move_task(task_id):
    user_id, role, err = _guard()
    if err:
        return err
    direction = (request.get_json() or {}).get("direction")
    if direction not in ("up", "down"):
        return jsonify({"success": False, "message": "direction deve ser 'up' ou 'down'."}), 422
    session = SessionLocal()
    try:
        response, status = task_service.move_task(session, user_id, role, task_id, direction)
        return jsonify(response), status
    finally:
        session.close()


@task_bp.route("/<string:task_id>/dependencies", methods=["POST"])
@jwt_required()
def create_dependency(task_id):
    user_id, role, err = _guard()
    if err:
        return err
    data = request.get_json() or {}
    session = SessionLocal()
    try:
        response, status = task_service.create_dependency(session, user_id, role, task_id, data)
        return jsonify(response), status
    finally:
        session.close()


@task_bp.route("/dependencies/<string:dependency_id>", methods=["DELETE"])
@jwt_required()
def delete_dependency(dependency_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = task_service.delete_dependency(session, user_id, role, dependency_id)
        return jsonify(response), status
    finally:
        session.close()


@task_bp.route("/<string:task_id>/comments", methods=["GET"])
@jwt_required()
def list_comments(task_id):
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        result, status = task_service.list_comments(session, task_id)
        return jsonify(result), status
    finally:
        session.close()


@task_bp.route("/<string:task_id>/comments", methods=["POST"])
@jwt_required()
def create_comment(task_id):
    user_id, role, err = _guard()
    if err:
        return err
    body = (request.get_json() or {}).get("body")
    session = SessionLocal()
    try:
        response, status = task_service.create_comment(session, user_id, role, task_id, body)
        return jsonify(response), status
    finally:
        session.close()

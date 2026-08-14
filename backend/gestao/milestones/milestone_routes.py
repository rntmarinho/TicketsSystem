from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, can_manage_team
from gestao.models.project_extras_models import Milestone
from gestao.models.project_models import Project
from gestao.utils import parse_datetime

milestone_bp = Blueprint("gestao_milestone_bp", __name__, url_prefix="/gestao")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


def _serialize(m):
    return {"id": m.id, "project_id": m.project_id, "title": m.title,
            "due_date": m.due_date.isoformat() if m.due_date else None, "done": m.done}


def _project_or_403(session, user_id, role, project_id):
    project = session.query(Project).get(project_id)
    if not project:
        return None, (jsonify({"success": False, "message": "Projeto não encontrado."}), 404)
    if not can_manage_team(session, user_id, role, project.team_id):
        return None, (jsonify({"success": False, "message": "Sem permissão."}), 403)
    return project, None


@milestone_bp.route("/projects/<string:project_id>/milestones", methods=["GET"])
@jwt_required()
def list_milestones(project_id):
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        rows = session.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.due_date.asc().nullslast()).all()
        return jsonify([_serialize(m) for m in rows]), 200
    finally:
        session.close()


@milestone_bp.route("/projects/<string:project_id>/milestones", methods=["POST"])
@jwt_required()
def create_milestone(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        _, perr = _project_or_403(session, user_id, role, project_id)
        if perr:
            return perr
        data = request.get_json() or {}
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"success": False, "message": "Título é obrigatório."}), 422
        milestone = Milestone(project_id=project_id, title=title, due_date=parse_datetime(data.get("due_date")))
        session.add(milestone)
        session.commit()
        return jsonify({"success": True, "milestone": _serialize(milestone)}), 201
    finally:
        session.close()


@milestone_bp.route("/milestones/<string:milestone_id>", methods=["PATCH"])
@jwt_required()
def update_milestone(milestone_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        milestone = session.query(Milestone).get(milestone_id)
        if not milestone:
            return jsonify({"success": False, "message": "Marco não encontrado."}), 404
        _, perr = _project_or_403(session, user_id, role, milestone.project_id)
        if perr:
            return perr
        data = request.get_json() or {}
        if "title" in data:
            milestone.title = (data["title"] or "").strip()
        if "due_date" in data:
            milestone.due_date = parse_datetime(data["due_date"])
        if "done" in data:
            milestone.done = bool(data["done"])
        session.commit()
        return jsonify({"success": True, "milestone": _serialize(milestone)}), 200
    finally:
        session.close()


@milestone_bp.route("/milestones/<string:milestone_id>", methods=["DELETE"])
@jwt_required()
def delete_milestone(milestone_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        milestone = session.query(Milestone).get(milestone_id)
        if not milestone:
            return jsonify({"success": False, "message": "Marco não encontrado."}), 404
        _, perr = _project_or_403(session, user_id, role, milestone.project_id)
        if perr:
            return perr
        session.delete(milestone)
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()

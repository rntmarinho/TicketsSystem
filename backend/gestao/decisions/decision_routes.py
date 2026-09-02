from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, can_manage_team, can_manage_project
from gestao.models.project_extras_models import Decision
from gestao.models.project_models import Project
from gestao.serializers import user_brief

decision_bp = Blueprint("gestao_decision_bp", __name__, url_prefix="/gestao")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


def _serialize(session, d):
    return {
        "id": d.id, "project_id": d.project_id, "title": d.title, "description": d.description,
        "decided_by": user_brief(session, d.decided_by_id),
        "decided_at": d.decided_at.isoformat() if d.decided_at else None,
    }


def _project_or_403(session, user_id, role, project_id):
    project = session.query(Project).get(project_id)
    if not project:
        return None, (jsonify({"success": False, "message": "Projeto não encontrado."}), 404)
    if not can_manage_project(session, user_id, role, project):
        return None, (jsonify({"success": False, "message": "Sem permissão."}), 403)
    return project, None


@decision_bp.route("/projects/<string:project_id>/decisions", methods=["GET"])
@jwt_required()
def list_decisions(project_id):
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        rows = session.query(Decision).filter(Decision.project_id == project_id).order_by(Decision.decided_at.desc()).all()
        return jsonify([_serialize(session, d) for d in rows]), 200
    finally:
        session.close()


@decision_bp.route("/projects/<string:project_id>/decisions", methods=["POST"])
@jwt_required()
def create_decision(project_id):
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
        decision = Decision(project_id=project_id, title=title, description=data.get("description"), decided_by_id=user_id)
        session.add(decision)
        session.commit()
        return jsonify({"success": True, "decision": _serialize(session, decision)}), 201
    finally:
        session.close()


@decision_bp.route("/decisions/<string:decision_id>", methods=["DELETE"])
@jwt_required()
def delete_decision(decision_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        decision = session.query(Decision).get(decision_id)
        if not decision:
            return jsonify({"success": False, "message": "Decisão não encontrada."}), 404
        _, perr = _project_or_403(session, user_id, role, decision.project_id)
        if perr:
            return perr
        session.delete(decision)
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()

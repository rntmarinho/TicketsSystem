from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, can_manage_team, can_manage_project
from gestao.models.goal_models import Goal, GoalAssignee
from gestao.models.project_models import Project
from gestao.serializers import user_brief
from gestao.utils import parse_datetime

goal_bp = Blueprint("gestao_goal_bp", __name__, url_prefix="/gestao/goals")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


def _serialize(session, goal):
    assignees = session.query(GoalAssignee.user_id).filter(GoalAssignee.goal_id == goal.id).all()
    return {
        "id": goal.id,
        "project_id": goal.project_id,
        "title": goal.title,
        "description": goal.description,
        "target_value": goal.target_value,
        "current_value": goal.current_value,
        "unit": goal.unit,
        "due_date": goal.due_date.isoformat() if goal.due_date else None,
        "assigned_team_id": goal.assigned_team_id,
        "parent_goal_id": goal.parent_goal_id,
        "assignees": [user_brief(session, r[0]) for r in assignees],
    }


def _can_manage_goal(session, user_id, role, goal):
    """Meta de projeto: quem gerencia a equipe do projeto. Meta solta/de equipe: ADMIN/DIRETOR
    ou gestor da equipe atribuída; sem equipe nem projeto, qualquer staff pode (meta pessoal)."""
    if role in ("ADMIN", "DIRETOR"):
        return True
    if goal.project_id:
        project = session.query(Project).get(goal.project_id)
        return project is not None and can_manage_project(session, user_id, role, project)
    if goal.assigned_team_id:
        return can_manage_team(session, user_id, role, goal.assigned_team_id)
    return True


@goal_bp.route("/", methods=["GET"])
@jwt_required()
def list_goals():
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        query = session.query(Goal)
        project_id = request.args.get("project_id")
        if project_id:
            query = query.filter(Goal.project_id == project_id)
        goals = query.order_by(Goal.created_at.desc()).all()
        return jsonify([_serialize(session, g) for g in goals]), 200
    finally:
        session.close()


@goal_bp.route("/", methods=["POST"])
@jwt_required()
def create_goal():
    user_id, role, err = _guard()
    if err:
        return err
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if len(title) < 2 or len(title) > 200:
        return jsonify({"success": False, "message": "Título deve ter entre 2 e 200 caracteres."}), 422

    session = SessionLocal()
    try:
        goal = Goal(
            project_id=data.get("project_id"),
            title=title,
            description=data.get("description"),
            target_value=data.get("target_value"),
            unit=data.get("unit"),
            due_date=parse_datetime(data.get("due_date")),
            assigned_team_id=data.get("assigned_team_id"),
            parent_goal_id=data.get("parent_goal_id"),
        )
        if not _can_manage_goal(session, user_id, role, goal):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        session.add(goal)
        session.flush()
        for assignee_id in data.get("assignee_ids", []):
            session.add(GoalAssignee(goal_id=goal.id, user_id=assignee_id))
        session.commit()
        return jsonify({"success": True, "goal": _serialize(session, goal)}), 201
    finally:
        session.close()


@goal_bp.route("/<string:goal_id>", methods=["PATCH"])
@jwt_required()
def update_goal(goal_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        goal = session.query(Goal).get(goal_id)
        if not goal:
            return jsonify({"success": False, "message": "Meta não encontrada."}), 404
        if not _can_manage_goal(session, user_id, role, goal):
            return jsonify({"success": False, "message": "Sem permissão."}), 403

        data = request.get_json() or {}
        if "title" in data:
            goal.title = (data["title"] or "").strip()
        if "description" in data:
            goal.description = data["description"]
        if "target_value" in data:
            goal.target_value = data["target_value"]
        if "current_value" in data:
            goal.current_value = data["current_value"]
        if "unit" in data:
            goal.unit = data["unit"]
        if "due_date" in data:
            goal.due_date = parse_datetime(data["due_date"])
        if "assignee_ids" in data:
            session.query(GoalAssignee).filter(GoalAssignee.goal_id == goal.id).delete()
            for assignee_id in data["assignee_ids"]:
                session.add(GoalAssignee(goal_id=goal.id, user_id=assignee_id))
        session.commit()
        return jsonify({"success": True, "goal": _serialize(session, goal)}), 200
    finally:
        session.close()


@goal_bp.route("/<string:goal_id>", methods=["DELETE"])
@jwt_required()
def delete_goal(goal_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        goal = session.query(Goal).get(goal_id)
        if not goal:
            return jsonify({"success": False, "message": "Meta não encontrada."}), 404
        if not _can_manage_goal(session, user_id, role, goal):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        session.delete(goal)
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()

"""
Portal do Cliente — blueprint ESTRUTURALMENTE separado das rotas internas do
módulo de gestão (backend/gestao/*), de propósito. No APPCNS original, o
portal do cliente usa as MESMAS rotas internas com um filtro condicional por
papel (`if role === 'CLIENTE'`) — frágil, porque uma rota nova pode esquecer
esse filtro e vazar dado. Aqui, CLIENTE nunca alcança `/gestao/*` (bloqueado
por `can_access_gestao`) — só alcança essas rotas próprias, cada uma já
nascendo com o filtro de `ProjectClient` embutido, sem depender de ninguém
lembrar de aplicá-lo depois.
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from gestao.models.project_models import Project
from gestao.models.task_models import Task
from gestao.models.message_models import ProjectClient
from gestao.serializers import serialize_project, user_brief
from services.progress import compute_percent_complete

portal_bp = Blueprint("portal_cliente_bp", __name__, url_prefix="/portal-cliente")


def _linked_project_ids(session, user_id):
    rows = session.query(ProjectClient.project_id).filter(ProjectClient.user_id == user_id).all()
    return [r[0] for r in rows]


@portal_bp.route("/projects", methods=["GET"])
@jwt_required()
def list_projects():
    user_id = int(get_jwt_identity())
    session = SessionLocal()
    try:
        project_ids = _linked_project_ids(session, user_id)
        if not project_ids:
            return jsonify([]), 200
        projects = session.query(Project).filter(Project.id.in_(project_ids)).order_by(Project.created_at.desc()).all()
        result = []
        for p in projects:
            tasks = [{"status": t.status} for t in p.tasks]
            result.append(serialize_project(session, p, percent_complete=compute_percent_complete(tasks)))
        return jsonify(result), 200
    finally:
        session.close()


@portal_bp.route("/projects/<string:project_id>", methods=["GET"])
@jwt_required()
def get_project(project_id):
    user_id = int(get_jwt_identity())
    session = SessionLocal()
    try:
        if project_id not in _linked_project_ids(session, user_id):
            return jsonify({"success": False, "message": "Projeto não encontrado."}), 404
        project = session.query(Project).get(project_id)
        if not project:
            return jsonify({"success": False, "message": "Projeto não encontrado."}), 404
        tasks = [{"status": t.status} for t in project.tasks]
        data = serialize_project(session, project, percent_complete=compute_percent_complete(tasks))
        return jsonify(data), 200
    finally:
        session.close()


@portal_bp.route("/projects/<string:project_id>/tasks", methods=["GET"])
@jwt_required()
def list_tasks(project_id):
    """Leitura só — o cliente acompanha o andamento, não edita nada por aqui."""
    user_id = int(get_jwt_identity())
    session = SessionLocal()
    try:
        if project_id not in _linked_project_ids(session, user_id):
            return jsonify({"success": False, "message": "Projeto não encontrado."}), 404
        tasks = (
            session.query(Task)
            .filter(Task.project_id == project_id, Task.parent_task_id.is_(None))
            .order_by(Task.order.asc())
            .all()
        )
        result = [
            {
                "id": t.id, "title": t.title, "status": t.status, "priority": t.priority,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "assignee": user_brief(session, t.assignee_id),
            }
            for t in tasks
        ]
        return jsonify(result), 200
    finally:
        session.close()

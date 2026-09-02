from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, can_manage_team, can_manage_project
from gestao.models.idea_models import Idea, IdeaComment, IDEA_STATUSES, IDEA_LEVELS
from gestao.models.task_models import Task
from gestao.models.project_models import Project
from gestao.serializers import user_brief

idea_bp = Blueprint("gestao_idea_bp", __name__, url_prefix="/gestao")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


def _serialize(session, i):
    return {
        "id": i.id, "project_id": i.project_id, "title": i.title, "description": i.description,
        "category": i.category, "status": i.status, "impact": i.impact, "viability": i.viability,
        "urgency": i.urgency, "created_by": user_brief(session, i.created_by_id),
        "assignee": user_brief(session, i.assignee_id), "assignee_id": i.assignee_id,
        "due_date": i.due_date.isoformat() if i.due_date else None,
        "converted_task_id": i.converted_task_id,
    }


def _project_or_403(session, user_id, role, project_id):
    project = session.query(Project).get(project_id)
    if not project:
        return None, (jsonify({"success": False, "message": "Projeto não encontrado."}), 404)
    if not can_manage_project(session, user_id, role, project):
        return None, (jsonify({"success": False, "message": "Sem permissão."}), 403)
    return project, None


@idea_bp.route("/projects/<string:project_id>/ideas", methods=["GET"])
@jwt_required()
def list_ideas(project_id):
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        rows = session.query(Idea).filter(Idea.project_id == project_id).order_by(Idea.created_at.desc()).all()
        return jsonify([_serialize(session, i) for i in rows]), 200
    finally:
        session.close()


@idea_bp.route("/projects/<string:project_id>/ideas", methods=["POST"])
@jwt_required()
def create_idea(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        project = session.query(Project).get(project_id)
        if not project:
            return jsonify({"success": False, "message": "Projeto não encontrado."}), 404
        # Qualquer staff com visibilidade do projeto pode registrar ideia — não
        # precisa ser gestor da equipe (diferente de milestone/risk/decision,
        # ideia é deliberadamente aberta pra qualquer um do time contribuir).
        data = request.get_json() or {}
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"success": False, "message": "Título é obrigatório."}), 422
        for field, allowed in (("impact", IDEA_LEVELS), ("viability", IDEA_LEVELS), ("urgency", IDEA_LEVELS)):
            if field in data and data[field] not in allowed:
                return jsonify({"success": False, "message": f"Valor inválido para {field}."}), 422
        idea = Idea(
            project_id=project_id, title=title, description=data.get("description"),
            category=data.get("category"), created_by_id=user_id, assignee_id=data.get("assignee_id"),
            impact=data.get("impact", "MEDIO"), viability=data.get("viability", "MEDIO"), urgency=data.get("urgency", "MEDIO"),
        )
        session.add(idea)
        session.commit()
        return jsonify({"success": True, "idea": _serialize(session, idea)}), 201
    finally:
        session.close()


@idea_bp.route("/ideas/<string:idea_id>", methods=["PATCH"])
@jwt_required()
def update_idea(idea_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        idea = session.query(Idea).get(idea_id)
        if not idea:
            return jsonify({"success": False, "message": "Ideia não encontrada."}), 404
        # Mudar status/avaliação é decisão de gestão; editar o próprio texto,
        # qualquer staff com visibilidade do projeto pode.
        data = request.get_json() or {}
        gestao_fields = {"status", "impact", "viability", "urgency"}
        if gestao_fields & data.keys():
            _, perr = _project_or_403(session, user_id, role, idea.project_id)
            if perr:
                return perr
        if "title" in data:
            idea.title = (data["title"] or "").strip()
        if "description" in data:
            idea.description = data["description"]
        if "category" in data:
            idea.category = data["category"]
        if "assignee_id" in data:
            idea.assignee_id = data["assignee_id"]
        if "status" in data:
            if data["status"] not in IDEA_STATUSES:
                return jsonify({"success": False, "message": "Status inválido."}), 422
            idea.status = data["status"]
        for field in ("impact", "viability", "urgency"):
            if field in data:
                if data[field] not in IDEA_LEVELS:
                    return jsonify({"success": False, "message": f"Valor inválido para {field}."}), 422
                setattr(idea, field, data[field])
        session.commit()
        return jsonify({"success": True, "idea": _serialize(session, idea)}), 200
    finally:
        session.close()


@idea_bp.route("/ideas/<string:idea_id>/convert", methods=["POST"])
@jwt_required()
def convert_idea(idea_id):
    """Cria uma Task a partir da ideia (mesmo projeto, título/descrição copiados),
    marca a ideia como CONVERTIDA e guarda o vínculo. Não apaga a ideia."""
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        idea = session.query(Idea).get(idea_id)
        if not idea:
            return jsonify({"success": False, "message": "Ideia não encontrada."}), 404
        _, perr = _project_or_403(session, user_id, role, idea.project_id)
        if perr:
            return perr
        if idea.converted_task_id:
            return jsonify({"success": False, "message": "Essa ideia já foi convertida."}), 409

        from gestao.tasks.task_service import _next_order
        task = Task(
            title=idea.title,
            description=idea.description,
            project_id=idea.project_id,
            assignee_id=idea.assignee_id,
            order=_next_order(session, idea.project_id),
            created_by=user_id,
        )
        session.add(task)
        session.flush()
        idea.converted_task_id = task.id
        idea.status = "CONVERTIDA"
        session.commit()
        return jsonify({"success": True, "task_id": task.id}), 200
    finally:
        session.close()


@idea_bp.route("/ideas/<string:idea_id>/comments", methods=["GET"])
@jwt_required()
def list_idea_comments(idea_id):
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        rows = session.query(IdeaComment).filter(IdeaComment.idea_id == idea_id).order_by(IdeaComment.created_at.asc()).all()
        return jsonify([
            {"id": c.id, "body": c.body, "author": user_brief(session, c.author_id),
             "created_at": c.created_at.isoformat() if c.created_at else None}
            for c in rows
        ]), 200
    finally:
        session.close()


@idea_bp.route("/ideas/<string:idea_id>/comments", methods=["POST"])
@jwt_required()
def create_idea_comment(idea_id):
    user_id, role, err = _guard()
    if err:
        return err
    body = (request.get_json() or {}).get("body", "").strip()
    if not body:
        return jsonify({"success": False, "message": "Comentário vazio."}), 422
    session = SessionLocal()
    try:
        idea = session.query(Idea).get(idea_id)
        if not idea:
            return jsonify({"success": False, "message": "Ideia não encontrada."}), 404
        comment = IdeaComment(idea_id=idea_id, author_id=user_id, body=body)
        session.add(comment)
        session.commit()
        return jsonify({"success": True, "comment": {
            "id": comment.id, "body": comment.body, "author": user_brief(session, user_id),
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
        }}), 201
    finally:
        session.close()

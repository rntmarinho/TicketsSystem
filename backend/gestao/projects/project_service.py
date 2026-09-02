from datetime import datetime, timezone
from gestao.models.project_models import Project, ProjectBoard, PROJECT_STATUSES
from gestao.models.team_models import Team
from gestao.models.task_models import Task
from gestao.models.message_models import ProjectClient
from gestao.serializers import serialize_project, user_brief
from gestao.models.legacy import LegacyDepartment
from services.gestao_permissions import (
    visible_project_ids, can_manage_project, can_view_project, get_user_department_id, PROJECT_MANAGER_ROLES,
)
from services.progress import compute_percent_complete

DEFAULT_TEAM_NAME = "Geral"


def _default_team_id(session):
    team = session.query(Team).filter(Team.name == DEFAULT_TEAM_NAME).first()
    return team.id if team else None


def list_projects(session, user_id, role):
    ids = visible_project_ids(session, user_id, role)
    query = session.query(Project)
    if ids is not None:
        if not ids:
            return []
        query = query.filter(Project.id.in_(ids))
    projects = query.order_by(Project.created_at.desc()).all()

    now = datetime.now(timezone.utc)
    result = []
    for p in projects:
        tasks = [{"status": t.status} for t in p.tasks]
        overdue = sum(
            1 for t in p.tasks
            if t.due_date and t.status != "FEITO" and t.due_date.replace(tzinfo=t.due_date.tzinfo or timezone.utc) < now
        )
        result.append(serialize_project(session, p, percent_complete=compute_percent_complete(tasks), overdue_count=overdue))
    return result


def create_project(session, user_id, role, data):
    if role == "VISUALIZADOR":
        return {"success": False, "message": "Seu perfil é somente leitura no módulo de projetos."}, 403

    name = (data.get("name") or "").strip()
    if len(name) < 2 or len(name) > 150:
        return {"success": False, "message": "Nome do projeto deve ter entre 2 e 150 caracteres."}, 422

    # Setor do projeto (02/09/2026): ADMIN/DIRETOR/GESTOR_PROJETO escolhem qualquer
    # setor (ou nenhum); os demais criam SÓ no próprio setor — o que vier no
    # payload é ignorado, e sem setor cadastrado não dá pra criar.
    own_department_id = get_user_department_id(session, user_id)
    if role in PROJECT_MANAGER_ROLES:
        department_id = data.get("department_id")
        if department_id is not None and session.query(LegacyDepartment).get(department_id) is None:
            return {"success": False, "message": "Setor inválido."}, 422
    else:
        if own_department_id is None:
            return {"success": False, "message": "Seu usuário não tem setor cadastrado — peça ao TI pra cadastrar antes de criar projeto."}, 422
        department_id = own_department_id

    team_id = data.get("team_id") or _default_team_id(session)
    if not team_id:
        return {"success": False, "message": "Nenhuma equipe disponível — contate um administrador."}, 500
    if role not in PROJECT_MANAGER_ROLES and team_id != _default_team_id(session):
        return {"success": False, "message": "Só TI/gestão pode escolher a equipe do projeto."}, 403

    status = data.get("status", "PLANEJADO")
    if status not in PROJECT_STATUSES:
        return {"success": False, "message": "Status de projeto inválido."}, 422

    approver_id = data.get("approver_id")
    project = Project(
        name=name,
        description=data.get("description"),
        team_id=team_id,
        department_id=department_id,
        owner_id=user_id,
        approver_id=approver_id,
        approval_status="PENDENTE" if approver_id else "NAO_REQUER",
        status=status,
        start_date=data.get("start_date"),
        end_date=data.get("end_date"),
    )
    session.add(project)
    session.commit()
    return {"success": True, "project": serialize_project(session, project)}, 201


def get_project(session, user_id, role, project_id):
    project = session.query(Project).get(project_id)
    # 404 (não 403) pra quem não enxerga — não revela que o id existe.
    if not project or not can_view_project(session, user_id, role, project):
        return {"success": False, "message": "Projeto não encontrado."}, 404
    tasks = [{"status": t.status} for t in project.tasks]
    data = serialize_project(session, project, percent_complete=compute_percent_complete(tasks))
    data["tasks"] = [t.id for t in project.tasks]
    return data, 200


def update_project(session, user_id, role, project_id, data):
    project = session.query(Project).get(project_id)
    if not project:
        return {"success": False, "message": "Projeto não encontrado."}, 404
    if not can_manage_project(session, user_id, role, project):
        return {"success": False, "message": "Sem permissão."}, 403

    if "name" in data:
        name = (data["name"] or "").strip()
        if len(name) < 2 or len(name) > 150:
            return {"success": False, "message": "Nome do projeto deve ter entre 2 e 150 caracteres."}, 422
        project.name = name
    if "description" in data:
        project.description = data["description"]
    if "team_id" in data and data["team_id"]:
        project.team_id = data["team_id"]
    if "department_id" in data:
        if role not in PROJECT_MANAGER_ROLES:
            return {"success": False, "message": "Só TI/gestão pode mudar o setor do projeto."}, 403
        if data["department_id"] is not None and session.query(LegacyDepartment).get(data["department_id"]) is None:
            return {"success": False, "message": "Setor inválido."}, 422
        project.department_id = data["department_id"]
    if "kanban_columns" in data:
        project.kanban_columns = data["kanban_columns"]
    if "approver_id" in data and data["approver_id"] != project.approver_id:
        project.approver_id = data["approver_id"]
        project.approval_status = "PENDENTE" if data["approver_id"] else "NAO_REQUER"
    if "start_date" in data:
        project.start_date = data["start_date"]
    if "end_date" in data:
        project.end_date = data["end_date"]
    if "status" in data and data["status"] != project.status:
        if data["status"] not in PROJECT_STATUSES:
            return {"success": False, "message": "Status de projeto inválido."}, 422
        if data["status"] == "EM_ANDAMENTO" and not project.actual_started_at:
            project.actual_started_at = datetime.now(timezone.utc)
        if data["status"] == "CONCLUIDO" and not project.actual_ended_at:
            project.actual_ended_at = datetime.now(timezone.utc)
        project.status = data["status"]

    session.commit()
    return {"success": True, "project": serialize_project(session, project)}, 200


def delete_project(session, user_id, role, project_id):
    project = session.query(Project).get(project_id)
    if not project:
        return {"success": False, "message": "Projeto não encontrado."}, 404
    if not can_manage_project(session, user_id, role, project):
        return {"success": False, "message": "Sem permissão."}, 403
    session.delete(project)
    session.commit()
    return {"success": True}, 200


def get_board(session, user_id, role, project_id):
    project = session.query(Project).get(project_id)
    if not project or not can_view_project(session, user_id, role, project):
        return {"success": False, "message": "Projeto não encontrado."}, 404
    board = session.query(ProjectBoard).filter(ProjectBoard.project_id == project_id).first()
    return {"content": board.content if board else ""}, 200


def update_board(session, user_id, role, project_id, content):
    project = session.query(Project).get(project_id)
    if not project:
        return {"success": False, "message": "Projeto não encontrado."}, 404
    if not can_manage_project(session, user_id, role, project):
        return {"success": False, "message": "Sem permissão."}, 403
    board = session.query(ProjectBoard).filter(ProjectBoard.project_id == project_id).first()
    if board is None:
        board = ProjectBoard(project_id=project_id, content=content or "")
        session.add(board)
    else:
        board.content = content or ""
    session.commit()
    return {"success": True}, 200


def list_project_clients(session, user_id, role, project_id):
    project = session.query(Project).get(project_id)
    if not project:
        return {"success": False, "message": "Projeto não encontrado."}, 404
    if not can_manage_project(session, user_id, role, project):
        return {"success": False, "message": "Sem permissão."}, 403
    rows = session.query(ProjectClient).filter(ProjectClient.project_id == project_id).all()
    return [user_brief(session, r.user_id) for r in rows], 200


def add_project_client(session, user_id, role, project_id, client_user_id):
    project = session.query(Project).get(project_id)
    if not project:
        return {"success": False, "message": "Projeto não encontrado."}, 404
    if not can_manage_project(session, user_id, role, project):
        return {"success": False, "message": "Sem permissão."}, 403
    existing = (
        session.query(ProjectClient)
        .filter(ProjectClient.project_id == project_id, ProjectClient.user_id == client_user_id)
        .first()
    )
    if not existing:
        session.add(ProjectClient(project_id=project_id, user_id=client_user_id))
        session.commit()
    return {"success": True}, 200


def remove_project_client(session, user_id, role, project_id, client_user_id):
    project = session.query(Project).get(project_id)
    if not project:
        return {"success": False, "message": "Projeto não encontrado."}, 404
    if not can_manage_project(session, user_id, role, project):
        return {"success": False, "message": "Sem permissão."}, 403
    row = (
        session.query(ProjectClient)
        .filter(ProjectClient.project_id == project_id, ProjectClient.user_id == client_user_id)
        .first()
    )
    if row:
        session.delete(row)
        session.commit()
    return {"success": True}, 200

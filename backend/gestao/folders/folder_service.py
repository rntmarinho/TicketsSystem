from gestao.models.attachment_models import Folder
from gestao.models.project_models import Project
from gestao.serializers import serialize_folder
from services.gestao_permissions import can_view_project, can_manage_team, can_manage_project


def list_folders(session, user_id, role, project_id):
    project = session.query(Project).get(project_id)
    if not project or not can_view_project(session, user_id, role, project):
        return {"success": False, "message": "Projeto não encontrado."}, 404
    folders = session.query(Folder).filter(Folder.project_id == project_id).order_by(Folder.name.asc()).all()
    return [serialize_folder(f) for f in folders], 200


def create_folder(session, user_id, role, project_id, data):
    project = session.query(Project).get(project_id)
    if not project:
        return {"success": False, "message": "Projeto não encontrado."}, 404
    if not can_manage_project(session, user_id, role, project):
        return {"success": False, "message": "Sem permissão."}, 403
    name = (data.get("name") or "").strip()
    if not name:
        return {"success": False, "message": "Nome da pasta é obrigatório."}, 422
    folder = Folder(name=name, project_id=project_id, parent_id=data.get("parent_id"), created_by=user_id)
    session.add(folder)
    session.commit()
    return {"success": True, "folder": serialize_folder(folder)}, 201


def delete_folder(session, user_id, role, folder_id):
    folder = session.query(Folder).get(folder_id)
    if not folder:
        return {"success": False, "message": "Pasta não encontrada."}, 404
    project = session.query(Project).get(folder.project_id) if folder.project_id else None
    if not project or not can_manage_project(session, user_id, role, project):
        return {"success": False, "message": "Sem permissão."}, 403
    session.delete(folder)
    session.commit()
    return {"success": True}, 200

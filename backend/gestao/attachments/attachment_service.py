import os
import uuid
from werkzeug.utils import secure_filename
from gestao.models.attachment_models import Attachment
from gestao.models.task_models import Task
from gestao.models.project_models import Project
from gestao.serializers import serialize_attachment
from services.gestao_permissions import can_view_task, can_view_project, can_manage_team

# Mesma lista de extensões permitidas do módulo de chamados (allowlist, não
# blocklist — decisão deliberada de endurecimento em relação ao APPCNS
# original, que usava blocklist de extensões executáveis).
EXTENSOES_PERMITIDAS = {
    'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
    'zip', 'rar', '7z', 'mp4', 'mp3'
}
TAMANHO_MAXIMO = 50 * 1024 * 1024  # 50 MB


def anexos_dir():
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "public", "gestao_anexos")


def _extensao_valida(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in EXTENSOES_PERMITIDAS


def list_task_attachments(session, user_id, role, task_id):
    task = session.query(Task).get(task_id)
    if not task or not can_view_task(session, user_id, role, task):
        return {"success": False, "message": "Tarefa não encontrada."}, 404
    return [serialize_attachment(session, a) for a in task.attachments], 200


def upload_task_attachment(session, user_id, role, task_id, file_storage):
    task = session.query(Task).get(task_id)
    if not task or not can_view_task(session, user_id, role, task):
        return {"success": False, "message": "Tarefa não encontrada."}, 404

    if not file_storage or file_storage.filename == "":
        return {"success": False, "message": "Nenhum arquivo enviado."}, 400
    if not _extensao_valida(file_storage.filename):
        return {"success": False, "message": "Extensão de arquivo não permitida."}, 400

    original_name = file_storage.filename
    ext = original_name.rsplit(".", 1)[1].lower()
    stored_name = f"{uuid.uuid4().hex}.{ext}"

    pasta = anexos_dir()
    os.makedirs(pasta, exist_ok=True)
    caminho_fisico = os.path.join(pasta, stored_name)
    file_storage.save(caminho_fisico)

    tamanho = os.path.getsize(caminho_fisico)
    if tamanho > TAMANHO_MAXIMO:
        os.remove(caminho_fisico)
        return {"success": False, "message": "Arquivo excede o limite de 50 MB."}, 400

    attachment = Attachment(
        task_id=task_id,
        file_name=secure_filename(original_name),
        file_path=stored_name,
        file_size=tamanho,
        mime_type=file_storage.mimetype or "application/octet-stream",
        uploaded_by=user_id,
    )
    session.add(attachment)
    session.commit()
    return {"success": True, "attachment": serialize_attachment(session, attachment)}, 201


def get_attachment_for_download(session, user_id, role, attachment_id):
    """Retorna (attachment, None) se o usuário pode baixar, ou (None, (response, status)) se não."""
    attachment = session.query(Attachment).get(attachment_id)
    if not attachment:
        return None, ({"success": False, "message": "Anexo não encontrado."}, 404)

    if attachment.task_id:
        task = session.query(Task).get(attachment.task_id)
        allowed = can_view_task(session, user_id, role, task)
    elif attachment.project_id:
        project = session.query(Project).get(attachment.project_id)
        allowed = can_view_project(session, user_id, role, project)
    else:
        allowed = False

    if not allowed:
        return None, ({"success": False, "message": "Anexo não encontrado."}, 404)
    return attachment, None


def delete_attachment(session, user_id, role, attachment_id):
    attachment = session.query(Attachment).get(attachment_id)
    if not attachment:
        return {"success": False, "message": "Anexo não encontrado."}, 404

    if attachment.task_id:
        task = session.query(Task).get(attachment.task_id)
        project = session.query(Project).get(task.project_id) if task and task.project_id else None
    elif attachment.project_id:
        project = session.query(Project).get(attachment.project_id)
    else:
        project = None

    is_uploader = attachment.uploaded_by == user_id
    allowed = role == "ADMIN" or is_uploader or (project and can_manage_team(session, user_id, role, project.team_id))
    if not allowed:
        return {"success": False, "message": "Sem permissão."}, 403

    caminho_fisico = os.path.join(anexos_dir(), attachment.file_path)
    if os.path.exists(caminho_fisico):
        os.remove(caminho_fisico)
    session.delete(attachment)
    session.commit()
    return {"success": True}, 200

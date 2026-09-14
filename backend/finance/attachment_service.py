import os
import uuid
from werkzeug.utils import secure_filename
from gestao.models.attachment_models import Attachment
from gestao.serializers import serialize_attachment
from finance.models import FinanceDemand
from finance.demand_routes import _is_financeiro

# Mesma allowlist e limite do módulo de Gestão (gestao/attachments/attachment_service.py)
# — sem motivo pra divergir, é o mesmo tipo de anexo (orçamento, nota fiscal, etc.).
EXTENSOES_PERMITIDAS = {
    'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
    'zip', 'rar', '7z', 'mp4', 'mp3'
}
TAMANHO_MAXIMO = 50 * 1024 * 1024  # 50 MB


def anexos_dir():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "public", "finance_anexos")


def _extensao_valida(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in EXTENSOES_PERMITIDAS


def _can_view_demand(session, user_id, role, demand):
    return bool(demand) and (demand.requester_id == user_id or _is_financeiro(session, user_id, role))


def list_demand_attachments(session, user_id, role, demand_id):
    demand = session.query(FinanceDemand).get(demand_id)
    if not _can_view_demand(session, user_id, role, demand):
        return {"success": False, "message": "Demanda não encontrada."}, 404
    rows = session.query(Attachment).filter(Attachment.demand_id == demand_id).order_by(Attachment.uploaded_at.asc()).all()
    return [serialize_attachment(session, a) for a in rows], 200


def upload_demand_attachment(session, user_id, role, demand_id, file_storage):
    demand = session.query(FinanceDemand).get(demand_id)
    if not _can_view_demand(session, user_id, role, demand):
        return {"success": False, "message": "Demanda não encontrada."}, 404

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
        demand_id=demand_id,
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
    if not attachment or not attachment.demand_id:
        return None, ({"success": False, "message": "Anexo não encontrado."}, 404)

    demand = session.query(FinanceDemand).get(attachment.demand_id)
    if not _can_view_demand(session, user_id, role, demand):
        return None, ({"success": False, "message": "Anexo não encontrado."}, 404)
    return attachment, None


def delete_attachment(session, user_id, role, attachment_id):
    attachment = session.query(Attachment).get(attachment_id)
    if not attachment or not attachment.demand_id:
        return {"success": False, "message": "Anexo não encontrado."}, 404

    demand = session.query(FinanceDemand).get(attachment.demand_id)
    is_uploader = attachment.uploaded_by == user_id
    allowed = is_uploader or _is_financeiro(session, user_id, role)
    if not allowed or not demand:
        return {"success": False, "message": "Sem permissão."}, 403

    caminho_fisico = os.path.join(anexos_dir(), attachment.file_path)
    if os.path.exists(caminho_fisico):
        os.remove(caminho_fisico)
    session.delete(attachment)
    session.commit()
    return {"success": True}, 200

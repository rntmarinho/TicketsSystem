import os
import uuid
from werkzeug.utils import secure_filename
from gestao.models.attachment_models import Attachment
from gestao.serializers import serialize_attachment
from rh.models import VagaSolicitacao, VagaCandidato
from services.gestao_permissions import get_user_department_id
from gestao.models.legacy import LegacyDepartment

# Mesma allowlist e limite do módulo de Gestão/Financeiro (é o mesmo tipo de
# anexo -- descrição de cargo, planilha, etc. -- sem motivo pra divergir).
EXTENSOES_PERMITIDAS = {
    'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
    'zip', 'rar', '7z', 'mp4', 'mp3'
}
TAMANHO_MAXIMO = 50 * 1024 * 1024  # 50 MB


def anexos_dir():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "public", "rh_anexos")


def _extensao_valida(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in EXTENSOES_PERMITIDAS


def _can_view_vaga(user_id, role, vaga):
    """Mesma regra de visibilidade de vaga_routes.py::list_vagas, mas sem
    depender de _is_rh aqui (evita import cruzado) -- ADMIN, o solicitante, e
    o aprovador designado podem ver/anexar. Setor RH inteiro é coberto à
    parte pelo chamador (rota já filtra antes de chegar aqui, se for o caso)."""
    if not vaga:
        return False
    if role == "ADMIN":
        return True
    return vaga.requester_id == user_id or vaga.aprovador_id == user_id


def _is_rh(user_id, role, session):
    """Mesma checagem de rh/vaga_routes.py::_is_rh, duplicada de propósito
    (evita import cruzado, mesma convenção já usada nesse arquivo)."""
    if role == "ADMIN":
        return True
    department_id = get_user_department_id(session, user_id)
    if department_id is None:
        return False
    dept = session.query(LegacyDepartment).get(department_id)
    return bool(dept and dept.name.strip().casefold() == "rh")


def _can_view_candidato(user_id, role, candidato, session):
    """Diferente de _can_view_vaga: candidato é dado só do RH (Bloco A do
    ATS, decisão da Renata) -- nem o aprovador da vaga vê."""
    if not candidato:
        return False
    return _is_rh(user_id, role, session)


def list_vaga_attachments(session, user_id, role, vaga_id):
    vaga = session.query(VagaSolicitacao).get(vaga_id)
    if not _can_view_vaga(user_id, role, vaga):
        return {"success": False, "message": "Solicitação não encontrada."}, 404
    rows = session.query(Attachment).filter(Attachment.vaga_id == vaga_id).order_by(Attachment.uploaded_at.asc()).all()
    return [serialize_attachment(session, a) for a in rows], 200


def upload_vaga_attachment(session, user_id, role, vaga_id, file_storage):
    vaga = session.query(VagaSolicitacao).get(vaga_id)
    if not _can_view_vaga(user_id, role, vaga):
        return {"success": False, "message": "Solicitação não encontrada."}, 404

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
        vaga_id=vaga_id,
        file_name=secure_filename(original_name),
        file_path=stored_name,
        file_size=tamanho,
        mime_type=file_storage.mimetype or "application/octet-stream",
        uploaded_by=user_id,
    )
    session.add(attachment)
    session.commit()
    return {"success": True, "attachment": serialize_attachment(session, attachment)}, 201


def list_candidato_attachments(session, user_id, role, candidato_id):
    candidato = session.query(VagaCandidato).get(candidato_id)
    if not _can_view_candidato(user_id, role, candidato, session):
        return {"success": False, "message": "Candidato não encontrado."}, 404
    rows = session.query(Attachment).filter(Attachment.candidato_id == candidato_id).order_by(Attachment.uploaded_at.asc()).all()
    return [serialize_attachment(session, a) for a in rows], 200


def upload_candidato_attachment(session, user_id, role, candidato_id, file_storage):
    candidato = session.query(VagaCandidato).get(candidato_id)
    if not _can_view_candidato(user_id, role, candidato, session):
        return {"success": False, "message": "Candidato não encontrado."}, 404

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
        candidato_id=candidato_id,
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
    attachment = session.query(Attachment).get(attachment_id)
    if not attachment or not (attachment.vaga_id or attachment.candidato_id):
        return None, ({"success": False, "message": "Anexo não encontrado."}, 404)

    if attachment.vaga_id:
        vaga = session.query(VagaSolicitacao).get(attachment.vaga_id)
        if not _can_view_vaga(user_id, role, vaga):
            return None, ({"success": False, "message": "Anexo não encontrado."}, 404)
    else:
        candidato = session.query(VagaCandidato).get(attachment.candidato_id)
        if not _can_view_candidato(user_id, role, candidato, session):
            return None, ({"success": False, "message": "Anexo não encontrado."}, 404)
    return attachment, None


def delete_attachment(session, user_id, role, attachment_id):
    attachment = session.query(Attachment).get(attachment_id)
    if not attachment or not (attachment.vaga_id or attachment.candidato_id):
        return {"success": False, "message": "Anexo não encontrado."}, 404

    is_uploader = attachment.uploaded_by == user_id
    if attachment.vaga_id:
        vaga = session.query(VagaSolicitacao).get(attachment.vaga_id)
        allowed = (is_uploader or role == "ADMIN") and vaga is not None
    else:
        candidato = session.query(VagaCandidato).get(attachment.candidato_id)
        allowed = (is_uploader or role == "ADMIN") and candidato is not None and _is_rh(user_id, role, session)
    if not allowed:
        return {"success": False, "message": "Sem permissão."}, 403

    caminho_fisico = os.path.join(anexos_dir(), attachment.file_path)
    if os.path.exists(caminho_fisico):
        os.remove(caminho_fisico)
    session.delete(attachment)
    session.commit()
    return {"success": True}, 200

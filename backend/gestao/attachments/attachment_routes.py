from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao
from services.rate_limiter import limiter
from gestao.attachments import attachment_service

attachment_bp = Blueprint("gestao_attachment_bp", __name__, url_prefix="/gestao")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


@attachment_bp.route("/tasks/<string:task_id>/attachments", methods=["GET"])
@jwt_required()
def list_task_attachments(task_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        result, status = attachment_service.list_task_attachments(session, user_id, role, task_id)
        return jsonify(result), status
    finally:
        session.close()


@attachment_bp.route("/tasks/<string:task_id>/attachments", methods=["POST"])
@jwt_required()
@limiter.limit("30 per minute")
def upload_task_attachment(task_id):
    user_id, role, err = _guard()
    if err:
        return err
    if "arquivo" not in request.files:
        return jsonify({"success": False, "message": "Campo 'arquivo' ausente."}), 400
    session = SessionLocal()
    try:
        response, status = attachment_service.upload_task_attachment(session, user_id, role, task_id, request.files["arquivo"])
        return jsonify(response), status
    finally:
        session.close()


# Token via querystring (?token=...) — mesmo padrão de backend/tickets/anexos/anexo_routes.py,
# necessário porque é um link <a href> direto, sem como mandar header Authorization customizado.
@attachment_bp.route("/attachments/<string:attachment_id>/download", methods=["GET"])
@jwt_required(locations=["query_string"])
def download_attachment(attachment_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        attachment, error = attachment_service.get_attachment_for_download(session, user_id, role, attachment_id)
        if error:
            response, status = error
            return jsonify(response), status
        return send_from_directory(
            attachment_service.anexos_dir(), attachment.file_path,
            as_attachment=True, download_name=attachment.file_name,
        )
    finally:
        session.close()


@attachment_bp.route("/attachments/<string:attachment_id>", methods=["DELETE"])
@jwt_required()
def delete_attachment(attachment_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        response, status = attachment_service.delete_attachment(session, user_id, role, attachment_id)
        return jsonify(response), status
    finally:
        session.close()

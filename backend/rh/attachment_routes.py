from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.rate_limiter import limiter
from rh import attachment_service

attachment_bp = Blueprint("rh_attachment_bp", __name__, url_prefix="/rh/vagas")


@attachment_bp.route("/<string:vaga_id>/attachments", methods=["GET"])
@jwt_required()
def list_vaga_attachments(vaga_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        result, status = attachment_service.list_vaga_attachments(session, user_id, role, vaga_id)
        return jsonify(result), status
    finally:
        session.close()


@attachment_bp.route("/<string:vaga_id>/attachments", methods=["POST"])
@jwt_required()
@limiter.limit("30 per minute")
def upload_vaga_attachment(vaga_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    if "arquivo" not in request.files:
        return jsonify({"success": False, "message": "Campo 'arquivo' ausente."}), 400
    session = SessionLocal()
    try:
        response, status = attachment_service.upload_vaga_attachment(session, user_id, role, vaga_id, request.files["arquivo"])
        return jsonify(response), status
    finally:
        session.close()


# Token via querystring — mesmo padrão de finance/attachment_routes.py, link
# <a href> direto não manda header Authorization customizado.
@attachment_bp.route("/attachments/<string:attachment_id>/download", methods=["GET"])
@jwt_required(locations=["query_string"])
def download_attachment(attachment_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
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
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        response, status = attachment_service.delete_attachment(session, user_id, role, attachment_id)
        return jsonify(response), status
    finally:
        session.close()


# Anexo de currículo do candidato (Bloco A do ATS, 19/09/2026) -- blueprint
# separado porque o prefixo de URL é diferente (/rh/candidatos, não /rh/vagas);
# download/exclusão reaproveitam as rotas genéricas acima (get_attachment_for_download
# e delete_attachment já resolvem vaga_id OU candidato_id pelo próprio anexo).
candidato_attachment_bp = Blueprint("rh_candidato_attachment_bp", __name__, url_prefix="/rh/candidatos")


@candidato_attachment_bp.route("/<string:candidato_id>/attachments", methods=["GET"])
@jwt_required()
def list_candidato_attachments(candidato_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        result, status = attachment_service.list_candidato_attachments(session, user_id, role, candidato_id)
        return jsonify(result), status
    finally:
        session.close()


@candidato_attachment_bp.route("/<string:candidato_id>/attachments", methods=["POST"])
@jwt_required()
@limiter.limit("30 per minute")
def upload_candidato_attachment(candidato_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    if "arquivo" not in request.files:
        return jsonify({"success": False, "message": "Campo 'arquivo' ausente."}), 400
    session = SessionLocal()
    try:
        response, status = attachment_service.upload_candidato_attachment(session, user_id, role, candidato_id, request.files["arquivo"])
        return jsonify(response), status
    finally:
        session.close()

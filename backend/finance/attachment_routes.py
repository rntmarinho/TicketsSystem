from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.rate_limiter import limiter
from finance import attachment_service

attachment_bp = Blueprint("finance_attachment_bp", __name__, url_prefix="/finance/demands")


@attachment_bp.route("/<string:demand_id>/attachments", methods=["GET"])
@jwt_required()
def list_demand_attachments(demand_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        result, status = attachment_service.list_demand_attachments(session, user_id, role, demand_id)
        return jsonify(result), status
    finally:
        session.close()


@attachment_bp.route("/<string:demand_id>/attachments", methods=["POST"])
@jwt_required()
@limiter.limit("30 per minute")
def upload_demand_attachment(demand_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    if "arquivo" not in request.files:
        return jsonify({"success": False, "message": "Campo 'arquivo' ausente."}), 400
    session = SessionLocal()
    try:
        response, status = attachment_service.upload_demand_attachment(session, user_id, role, demand_id, request.files["arquivo"])
        return jsonify(response), status
    finally:
        session.close()


# Token via querystring (?token=...) — mesmo padrão de gestao/attachments/attachment_routes.py,
# necessário porque é um link <a href> direto, sem como mandar header Authorization customizado.
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

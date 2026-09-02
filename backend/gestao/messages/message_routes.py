from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, is_team_member
from services.jitsi import build_jitsi_url
from services.call_message import build_call_message
from gestao.messages import message_service
from gestao.attachments.attachment_service import upload_team_message_attachment, upload_direct_message_attachment

message_bp = Blueprint("gestao_message_bp", __name__, url_prefix="/gestao/messages")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


@message_bp.route("/team/<string:team_id>", methods=["GET"])
@jwt_required()
def list_team_messages(team_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        result, status = message_service.list_team_messages(session, user_id, role, team_id)
        return jsonify(result), status
    finally:
        session.close()


@message_bp.route("/team/<string:team_id>", methods=["POST"])
@jwt_required()
def create_team_message(team_id):
    user_id, role, err = _guard()
    if err:
        return err
    body = (request.get_json() or {}).get("body")
    session = SessionLocal()
    try:
        response, status = message_service.create_team_message(session, user_id, role, team_id, body)
        return jsonify(response), status
    finally:
        session.close()


@message_bp.route("/team/<string:team_id>/call", methods=["POST"])
@jwt_required()
def start_team_call(team_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        if not is_team_member(session, user_id, role, team_id):
            return jsonify({"success": False, "message": "Você não participa dessa equipe."}), 403
        url = build_jitsi_url(team_id)
        response, status = message_service.create_team_message(session, user_id, role, team_id, build_call_message(url))
        if response.get("success"):
            response["jitsi_url"] = url
        return jsonify(response), status
    finally:
        session.close()


@message_bp.route("/team/<string:team_id>/attachment", methods=["POST"])
@jwt_required()
def upload_team_attachment(team_id):
    user_id, role, err = _guard()
    if err:
        return err
    if "arquivo" not in request.files:
        return jsonify({"success": False, "message": "Campo 'arquivo' ausente."}), 400
    session = SessionLocal()
    try:
        response, status = upload_team_message_attachment(session, user_id, role, team_id, request.files["arquivo"])
        return jsonify(response), status
    finally:
        session.close()


@message_bp.route("/direct/<int:other_user_id>", methods=["GET"])
@jwt_required()
def list_direct_messages(other_user_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        result, status = message_service.list_direct_messages(session, user_id, other_user_id)
        return jsonify(result), status
    finally:
        session.close()


@message_bp.route("/direct/<int:other_user_id>", methods=["POST"])
@jwt_required()
def create_direct_message(other_user_id):
    user_id, role, err = _guard()
    if err:
        return err
    body = (request.get_json() or {}).get("body")
    session = SessionLocal()
    try:
        response, status = message_service.create_direct_message(session, user_id, other_user_id, body)
        return jsonify(response), status
    finally:
        session.close()


@message_bp.route("/direct/<int:other_user_id>/call", methods=["POST"])
@jwt_required()
def start_direct_call(other_user_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        url = build_jitsi_url(f"dm-{min(user_id, other_user_id)}-{max(user_id, other_user_id)}")
        response, status = message_service.create_direct_message(session, user_id, other_user_id, build_call_message(url))
        if response.get("success"):
            response["jitsi_url"] = url
        return jsonify(response), status
    finally:
        session.close()


@message_bp.route("/direct/<int:other_user_id>/attachment", methods=["POST"])
@jwt_required()
def upload_direct_attachment(other_user_id):
    user_id, role, err = _guard()
    if err:
        return err
    if "arquivo" not in request.files:
        return jsonify({"success": False, "message": "Campo 'arquivo' ausente."}), 400
    session = SessionLocal()
    try:
        response, status = upload_direct_message_attachment(session, user_id, role, other_user_id, request.files["arquivo"])
        return jsonify(response), status
    finally:
        session.close()


@message_bp.route("/unread", methods=["GET"])
@jwt_required()
def unread():
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        return jsonify(message_service.unread_summary(session, user_id)), 200
    finally:
        session.close()


@message_bp.route("/calls", methods=["GET"])
@jwt_required()
def calls():
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        return jsonify(message_service.call_history(session, user_id)), 200
    finally:
        session.close()


@message_bp.route("/incoming-calls", methods=["GET"])
@jwt_required()
def incoming_calls():
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        return jsonify(message_service.incoming_calls(session, user_id)), 200
    finally:
        session.close()

from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, STAFF_ROLES
from gestao.models.legacy import LegacyUser

presence_bp = Blueprint("gestao_presence_bp", __name__, url_prefix="/gestao/presence")

ONLINE_WINDOW_SECONDS = 60


@presence_bp.route("/heartbeat", methods=["POST"])
@jwt_required()
def heartbeat():
    role = get_current_role()
    if not can_access_gestao(role):
        return jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403
    user_id = int(get_jwt_identity())
    session = SessionLocal()
    try:
        user = session.query(LegacyUser).get(user_id)
        if user:
            user.last_seen_at = datetime.now(timezone.utc)
            session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@presence_bp.route("/", methods=["GET"])
@jwt_required()
def list_presence():
    role = get_current_role()
    if not can_access_gestao(role):
        return jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403
    session = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=ONLINE_WINDOW_SECONDS)
        users = session.query(LegacyUser).filter(LegacyUser.access_type.in_(STAFF_ROLES)).all()
        result = []
        for u in users:
            last_seen = u.last_seen_at
            online = bool(last_seen and last_seen.replace(tzinfo=last_seen.tzinfo or timezone.utc) >= cutoff)
            result.append({"user_id": u.id, "online": online, "last_seen_at": last_seen.isoformat() if last_seen else None})
        return jsonify(result), 200
    finally:
        session.close()

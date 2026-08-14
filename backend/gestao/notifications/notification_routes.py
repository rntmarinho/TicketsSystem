from datetime import datetime, timezone
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao
from gestao.models.notification_models import Notification

notification_bp = Blueprint("gestao_notification_bp", __name__, url_prefix="/gestao/notifications")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), None


def _serialize(n):
    return {
        "id": n.id, "type": n.type, "title": n.title, "body": n.body, "link": n.link,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@notification_bp.route("/", methods=["GET"])
@jwt_required()
def list_notifications():
    user_id, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        rows = (
            session.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(50)
            .all()
        )
        return jsonify([_serialize(n) for n in rows]), 200
    finally:
        session.close()


@notification_bp.route("/unread-count", methods=["GET"])
@jwt_required()
def unread_count():
    user_id, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        count = (
            session.query(Notification)
            .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
            .count()
        )
        return jsonify({"count": count}), 200
    finally:
        session.close()


@notification_bp.route("/<string:notification_id>/read", methods=["POST"])
@jwt_required()
def mark_read(notification_id):
    user_id, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        notification = session.query(Notification).get(notification_id)
        if not notification or notification.user_id != user_id:
            return jsonify({"success": False, "message": "Notificação não encontrada."}), 404
        if not notification.read_at:
            notification.read_at = datetime.now(timezone.utc)
            session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@notification_bp.route("/read-all", methods=["POST"])
@jwt_required()
def mark_all_read():
    user_id, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        (
            session.query(Notification)
            .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
            .update({Notification.read_at: now})
        )
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from gestao.models.audit_models import AuditLog
from gestao.serializers import user_brief

audit_bp = Blueprint("gestao_audit_bp", __name__, url_prefix="/gestao/audit-log")


@audit_bp.route("/", methods=["GET"])
@jwt_required()
def list_audit_log():
    role = get_current_role()
    if role not in ("ADMIN", "DIRETOR"):
        return jsonify({"success": False, "message": "Só admin ou diretor pode ver o log de auditoria."}), 403
    session = SessionLocal()
    try:
        query = session.query(AuditLog)
        entity_type = request.args.get("entity_type")
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        rows = query.order_by(AuditLog.created_at.desc()).limit(300).all()
        return jsonify([
            {
                "id": r.id, "user": user_brief(session, r.user_id), "action": r.action,
                "entity_type": r.entity_type, "entity_id": r.entity_id,
                "metadata": r.metadata_json, "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]), 200
    finally:
        session.close()

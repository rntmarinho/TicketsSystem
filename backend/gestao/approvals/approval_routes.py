from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao
from gestao.models.approval_models import ApprovalRequest
from gestao.serializers import user_brief
from gestao.notify import notify
from gestao.audit_log import record as audit_record

approval_bp = Blueprint("gestao_approval_bp", __name__, url_prefix="/gestao/approval-requests")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


def _serialize(session, req):
    return {
        "id": req.id,
        "title": req.title,
        "description": req.description,
        "status": req.status,
        "requester": user_brief(session, req.requester_id),
        "approver": user_brief(session, req.approver_id),
        "decided_at": req.decided_at.isoformat() if req.decided_at else None,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


@approval_bp.route("/", methods=["GET"])
@jwt_required()
def list_requests():
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        requests = (
            session.query(ApprovalRequest)
            .filter(or_(ApprovalRequest.approver_id == user_id, ApprovalRequest.requester_id == user_id))
            .order_by(ApprovalRequest.created_at.desc())
            .limit(100)
            .all()
        )
        return jsonify([_serialize(session, r) for r in requests]), 200
    finally:
        session.close()


@approval_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    user_id, role, err = _guard()
    if err:
        return err
    if role == "VISUALIZADOR":
        return jsonify({"success": False, "message": "Seu perfil não pode criar solicitações de aprovação."}), 403

    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    approver_id = data.get("approver_id")
    if len(title) < 2 or len(title) > 200:
        return jsonify({"success": False, "message": "Título deve ter entre 2 e 200 caracteres."}), 422
    if not approver_id:
        return jsonify({"success": False, "message": "Escolha quem vai aprovar."}), 422
    if approver_id == user_id:
        return jsonify({"success": False, "message": "Escolha outra pessoa para aprovar."}), 422

    session = SessionLocal()
    try:
        req = ApprovalRequest(
            title=title,
            description=data.get("description"),
            requester_id=user_id,
            approver_id=approver_id,
            status="PENDENTE",
        )
        session.add(req)
        session.flush()
        notify(session, approver_id, f"Aprovação pendente: {title}", type="APROVACAO_PENDENTE", link="/gestao/aprovacoes")
        audit_record(session, user_id, "criar_solicitacao_aprovacao", "ApprovalRequest", req.id, {"title": title})
        session.commit()
        return jsonify({"success": True, "request": _serialize(session, req)}), 201
    finally:
        session.close()


@approval_bp.route("/<string:request_id>", methods=["PATCH"])
@jwt_required()
def decide_request(request_id):
    user_id, role, err = _guard()
    if err:
        return err
    decision = (request.get_json() or {}).get("status")
    if decision not in ("APROVADO", "REJEITADO"):
        return jsonify({"success": False, "message": "status deve ser APROVADO ou REJEITADO."}), 422

    session = SessionLocal()
    try:
        req = session.query(ApprovalRequest).get(request_id)
        if not req:
            return jsonify({"success": False, "message": "Solicitação não encontrada."}), 404
        if req.approver_id != user_id and role != "ADMIN":
            return jsonify({"success": False, "message": "Só o aprovador designado pode decidir."}), 403
        if req.status != "PENDENTE":
            return jsonify({"success": False, "message": "Essa solicitação já foi decidida."}), 409

        req.status = decision
        req.decided_at = datetime.now(timezone.utc)
        notify(session, req.requester_id, f"Solicitação \"{req.title}\" foi {decision.lower()}", type="OUTRO")
        audit_record(session, user_id, "decidir_solicitacao_aprovacao", "ApprovalRequest", req.id, {"status": decision})
        session.commit()
        return jsonify({"success": True, "request": _serialize(session, req)}), 200
    finally:
        session.close()

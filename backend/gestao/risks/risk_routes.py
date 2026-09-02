from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, can_manage_team, can_manage_project
from gestao.models.project_extras_models import Risk, RISK_LEVELS, RISK_STATUSES
from gestao.models.project_models import Project

risk_bp = Blueprint("gestao_risk_bp", __name__, url_prefix="/gestao")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


def _serialize(r):
    return {
        "id": r.id, "project_id": r.project_id, "title": r.title, "description": r.description,
        "impact": r.impact, "probability": r.probability, "mitigation_plan": r.mitigation_plan,
        "status": r.status,
    }


def _project_or_403(session, user_id, role, project_id):
    project = session.query(Project).get(project_id)
    if not project:
        return None, (jsonify({"success": False, "message": "Projeto não encontrado."}), 404)
    if not can_manage_project(session, user_id, role, project):
        return None, (jsonify({"success": False, "message": "Sem permissão."}), 403)
    return project, None


@risk_bp.route("/projects/<string:project_id>/risks", methods=["GET"])
@jwt_required()
def list_risks(project_id):
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        rows = session.query(Risk).filter(Risk.project_id == project_id).order_by(Risk.created_at.desc()).all()
        return jsonify([_serialize(r) for r in rows]), 200
    finally:
        session.close()


@risk_bp.route("/projects/<string:project_id>/risks", methods=["POST"])
@jwt_required()
def create_risk(project_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        _, perr = _project_or_403(session, user_id, role, project_id)
        if perr:
            return perr
        data = request.get_json() or {}
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"success": False, "message": "Título é obrigatório."}), 422
        for field in ("impact", "probability"):
            if field in data and data[field] not in RISK_LEVELS:
                return jsonify({"success": False, "message": f"Valor inválido para {field}."}), 422
        risk = Risk(
            project_id=project_id, title=title, description=data.get("description"),
            impact=data.get("impact", "MEDIO"), probability=data.get("probability", "MEDIO"),
            mitigation_plan=data.get("mitigation_plan"),
        )
        session.add(risk)
        session.commit()
        return jsonify({"success": True, "risk": _serialize(risk)}), 201
    finally:
        session.close()


@risk_bp.route("/risks/<string:risk_id>", methods=["PATCH"])
@jwt_required()
def update_risk(risk_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        risk = session.query(Risk).get(risk_id)
        if not risk:
            return jsonify({"success": False, "message": "Risco não encontrado."}), 404
        _, perr = _project_or_403(session, user_id, role, risk.project_id)
        if perr:
            return perr
        data = request.get_json() or {}
        if "title" in data:
            risk.title = (data["title"] or "").strip()
        if "description" in data:
            risk.description = data["description"]
        if "impact" in data:
            if data["impact"] not in RISK_LEVELS:
                return jsonify({"success": False, "message": "Impacto inválido."}), 422
            risk.impact = data["impact"]
        if "probability" in data:
            if data["probability"] not in RISK_LEVELS:
                return jsonify({"success": False, "message": "Probabilidade inválida."}), 422
            risk.probability = data["probability"]
        if "mitigation_plan" in data:
            risk.mitigation_plan = data["mitigation_plan"]
        if "status" in data:
            if data["status"] not in RISK_STATUSES:
                return jsonify({"success": False, "message": "Status inválido."}), 422
            risk.status = data["status"]
        session.commit()
        return jsonify({"success": True, "risk": _serialize(risk)}), 200
    finally:
        session.close()


@risk_bp.route("/risks/<string:risk_id>", methods=["DELETE"])
@jwt_required()
def delete_risk(risk_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        risk = session.query(Risk).get(risk_id)
        if not risk:
            return jsonify({"success": False, "message": "Risco não encontrado."}), 404
        _, perr = _project_or_403(session, user_id, role, risk.project_id)
        if perr:
            return perr
        session.delete(risk)
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()

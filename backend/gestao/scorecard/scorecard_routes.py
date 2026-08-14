from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, can_manage_team
from gestao.models.scorecard_models import ScorecardItem, SCORECARD_SCOPES, SCORECARD_STATUS_COLORS
from gestao.models.project_models import Project

scorecard_bp = Blueprint("gestao_scorecard_bp", __name__, url_prefix="/gestao/scorecard")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


def _serialize(s):
    return {
        "id": s.id, "scope": s.scope, "team_id": s.team_id, "project_id": s.project_id, "user_id": s.user_id,
        "objective": s.objective, "indicator": s.indicator, "target": s.target, "current": s.current,
        "unit": s.unit, "status_color": s.status_color, "trend": s.trend, "periodicity": s.periodicity,
        "justification": s.justification,
    }


def _can_manage(session, user_id, role, item):
    if role in ("ADMIN", "DIRETOR"):
        return True
    if item.scope == "PESSOAL":
        return item.user_id == user_id
    if item.scope == "PROJETO" and item.project_id:
        project = session.query(Project).get(item.project_id)
        return project is not None and can_manage_team(session, user_id, role, project.team_id)
    if item.scope == "EQUIPE" and item.team_id:
        return can_manage_team(session, user_id, role, item.team_id)
    return False  # CORPORATIVO: só ADMIN/DIRETOR


@scorecard_bp.route("/", methods=["GET"])
@jwt_required()
def list_items():
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        query = session.query(ScorecardItem)
        scope = request.args.get("scope")
        if scope:
            if scope not in SCORECARD_SCOPES:
                return jsonify({"success": False, "message": "scope inválido."}), 422
            query = query.filter(ScorecardItem.scope == scope)
        project_id = request.args.get("project_id")
        if project_id:
            query = query.filter(ScorecardItem.project_id == project_id)
        team_id = request.args.get("team_id")
        if team_id:
            query = query.filter(ScorecardItem.team_id == team_id)
        if scope == "PESSOAL" and not project_id and not team_id:
            query = query.filter(ScorecardItem.user_id == user_id)
        items = query.order_by(ScorecardItem.created_at.desc()).all()
        return jsonify([_serialize(i) for i in items]), 200
    finally:
        session.close()


@scorecard_bp.route("/", methods=["POST"])
@jwt_required()
def create_item():
    user_id, role, err = _guard()
    if err:
        return err
    data = request.get_json() or {}
    scope = data.get("scope")
    if scope not in SCORECARD_SCOPES:
        return jsonify({"success": False, "message": "scope inválido."}), 422
    objective = (data.get("objective") or "").strip()
    indicator = (data.get("indicator") or "").strip()
    if not objective or not indicator:
        return jsonify({"success": False, "message": "Objetivo e indicador são obrigatórios."}), 422
    if data.get("status_color") and data["status_color"] not in SCORECARD_STATUS_COLORS:
        return jsonify({"success": False, "message": "Cor de status inválida."}), 422

    session = SessionLocal()
    try:
        item = ScorecardItem(
            scope=scope,
            team_id=data.get("team_id"),
            project_id=data.get("project_id"),
            user_id=data.get("user_id", user_id) if scope == "PESSOAL" else data.get("user_id"),
            objective=objective, indicator=indicator, target=data.get("target"),
            unit=data.get("unit"), status_color=data.get("status_color", "VERDE"),
            trend=data.get("trend"), periodicity=data.get("periodicity"), justification=data.get("justification"),
        )
        if not _can_manage(session, user_id, role, item):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        session.add(item)
        session.commit()
        return jsonify({"success": True, "item": _serialize(item)}), 201
    finally:
        session.close()


@scorecard_bp.route("/<string:item_id>", methods=["PATCH"])
@jwt_required()
def update_item(item_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        item = session.query(ScorecardItem).get(item_id)
        if not item:
            return jsonify({"success": False, "message": "Item não encontrado."}), 404
        if not _can_manage(session, user_id, role, item):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        data = request.get_json() or {}
        for field in ("objective", "indicator", "unit", "trend", "periodicity", "justification"):
            if field in data:
                setattr(item, field, data[field])
        if "target" in data:
            item.target = data["target"]
        if "current" in data:
            item.current = data["current"]
        if "status_color" in data:
            if data["status_color"] not in SCORECARD_STATUS_COLORS:
                return jsonify({"success": False, "message": "Cor de status inválida."}), 422
            item.status_color = data["status_color"]
        session.commit()
        return jsonify({"success": True, "item": _serialize(item)}), 200
    finally:
        session.close()


@scorecard_bp.route("/<string:item_id>", methods=["DELETE"])
@jwt_required()
def delete_item(item_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        item = session.query(ScorecardItem).get(item_id)
        if not item:
            return jsonify({"success": False, "message": "Item não encontrado."}), 404
        if not _can_manage(session, user_id, role, item):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        session.delete(item)
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()

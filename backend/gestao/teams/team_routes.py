"""
Fase 1 trouxe só listagem — o suficiente pra popular o dropdown de equipe na
criação de projeto e a lista de responsável possível numa tarefa. Fase 2
completa com CRUD de equipe e gestão de membros.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, can_manage_team, can_manage_org_structure, STAFF_ROLES
from gestao.models.team_models import Team, UserTeam, TEAM_ROLES
from gestao.models.legacy import LegacyUser
from gestao.serializers import serialize_team
from gestao.audit_log import record as audit_record

team_bp = Blueprint("gestao_team_bp", __name__, url_prefix="/gestao/teams")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


@team_bp.route("/", methods=["GET"])
@jwt_required()
def list_teams():
    role = get_current_role()
    if not can_access_gestao(role):
        return jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403
    session = SessionLocal()
    try:
        teams = session.query(Team).order_by(Team.name.asc()).all()
        return jsonify([serialize_team(t) for t in teams]), 200
    finally:
        session.close()


@team_bp.route("/<string:team_id>/members", methods=["GET"])
@jwt_required()
def list_team_members(team_id):
    role = get_current_role()
    if not can_access_gestao(role):
        return jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403
    session = SessionLocal()
    try:
        rows = (
            session.query(LegacyUser.id, LegacyUser.name, LegacyUser.email, UserTeam.role)
            .join(UserTeam, UserTeam.user_id == LegacyUser.id)
            .filter(UserTeam.team_id == team_id)
            .order_by(LegacyUser.name.asc())
            .all()
        )
        return jsonify([{"id": r[0], "name": r[1], "email": r[2], "team_role": r[3]} for r in rows]), 200
    finally:
        session.close()


@team_bp.route("/staff", methods=["GET"])
@jwt_required()
def list_staff():
    """Lista todo o staff (qualquer papel exceto CLIENTE) — usado pra escolher
    responsável de tarefa. Não é uma listagem por equipe porque, na Fase 1,
    só existe a equipe padrão "Geral" com todo o staff dentro."""
    role = get_current_role()
    if not can_access_gestao(role):
        return jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403
    session = SessionLocal()
    try:
        users = (
            session.query(LegacyUser)
            .filter(LegacyUser.access_type.in_(STAFF_ROLES), LegacyUser.situation == "A")
            .order_by(LegacyUser.name.asc())
            .all()
        )
        return jsonify([{"id": u.id, "name": u.name, "email": u.email, "access_type": u.access_type} for u in users]), 200
    finally:
        session.close()


@team_bp.route("/", methods=["POST"])
@jwt_required()
def create_team():
    user_id, role, err = _guard()
    if err:
        return err
    if not can_manage_org_structure(role):
        return jsonify({"success": False, "message": "Só admin ou diretor pode criar equipes."}), 403

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if len(name) < 2 or len(name) > 150:
        return jsonify({"success": False, "message": "Nome da equipe deve ter entre 2 e 150 caracteres."}), 422

    session = SessionLocal()
    try:
        if session.query(Team).filter(Team.name == name).first():
            return jsonify({"success": False, "message": "Já existe uma equipe com esse nome."}), 409
        team = Team(name=name, description=data.get("description"))
        session.add(team)
        session.flush()
        audit_record(session, user_id, "criar_equipe", "Team", team.id, {"name": name})
        session.commit()
        return jsonify({"success": True, "team": serialize_team(team)}), 201
    finally:
        session.close()


@team_bp.route("/<string:team_id>", methods=["PATCH"])
@jwt_required()
def update_team(team_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        team = session.query(Team).get(team_id)
        if not team:
            return jsonify({"success": False, "message": "Equipe não encontrada."}), 404
        if not can_manage_team(session, user_id, role, team_id):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        data = request.get_json() or {}
        if "name" in data:
            name = (data["name"] or "").strip()
            if len(name) < 2 or len(name) > 150:
                return jsonify({"success": False, "message": "Nome da equipe deve ter entre 2 e 150 caracteres."}), 422
            team.name = name
        if "description" in data:
            team.description = data["description"]
        session.commit()
        return jsonify({"success": True, "team": serialize_team(team)}), 200
    finally:
        session.close()


@team_bp.route("/<string:team_id>", methods=["DELETE"])
@jwt_required()
def delete_team(team_id):
    user_id, role, err = _guard()
    if err:
        return err
    if not can_manage_org_structure(role):
        return jsonify({"success": False, "message": "Só admin ou diretor pode remover equipes."}), 403
    session = SessionLocal()
    try:
        team = session.query(Team).get(team_id)
        if not team:
            return jsonify({"success": False, "message": "Equipe não encontrada."}), 404
        if session.query(Team).count() <= 1:
            return jsonify({"success": False, "message": "Não é possível remover a última equipe restante."}), 422
        audit_record(session, user_id, "remover_equipe", "Team", team.id, {"name": team.name})
        session.delete(team)
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@team_bp.route("/<string:team_id>/members", methods=["POST"])
@jwt_required()
def add_team_member(team_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        if not can_manage_team(session, user_id, role, team_id):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        data = request.get_json() or {}
        target_user_id = data.get("user_id")
        member_role = data.get("role", "MEMBRO")
        if member_role not in TEAM_ROLES:
            return jsonify({"success": False, "message": "Papel de equipe inválido."}), 422
        existing = (
            session.query(UserTeam)
            .filter(UserTeam.user_id == target_user_id, UserTeam.team_id == team_id)
            .first()
        )
        if existing:
            existing.role = member_role
        else:
            session.add(UserTeam(user_id=target_user_id, team_id=team_id, role=member_role))
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@team_bp.route("/<string:team_id>/members/<int:target_user_id>", methods=["DELETE"])
@jwt_required()
def remove_team_member(team_id, target_user_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        if not can_manage_team(session, user_id, role, team_id):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        membership = (
            session.query(UserTeam)
            .filter(UserTeam.user_id == target_user_id, UserTeam.team_id == team_id)
            .first()
        )
        if not membership:
            return jsonify({"success": False, "message": "Vínculo não encontrado."}), 404
        session.delete(membership)
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()

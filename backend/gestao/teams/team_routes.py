"""
Fase 1: só listagem — o suficiente pra popular o dropdown de equipe na criação
de projeto e a lista de responsável possível numa tarefa. CRUD completo de
equipe (criar, editar, gerenciar membros) chega na Fase 2, junto com Núcleo/
organograma.
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, STAFF_ROLES
from gestao.models.team_models import Team, UserTeam
from gestao.models.legacy import LegacyUser
from gestao.serializers import serialize_team

team_bp = Blueprint("gestao_team_bp", __name__, url_prefix="/gestao/teams")


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
            .filter(LegacyUser.access_type.in_(STAFF_ROLES))
            .order_by(LegacyUser.name.asc())
            .all()
        )
        return jsonify([{"id": u.id, "name": u.name, "email": u.email, "access_type": u.access_type} for u in users]), 200
    finally:
        session.close()

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import get_user_department_id
from gestao.models.legacy import LegacyDepartment
from gestao.serializers import user_brief
from rh.models import VagaSolicitacao, VagaCandidato, VagaCandidatoComentario, CANDIDATO_ETAPAS

# Bloco A do ATS (19/09/2026): pipeline de candidatos por vaga. Só RH/ADMIN
# vê ou mexe (decisão da Renata -- nem o aprovador/gestor da vaga participa
# disso, diferente da solicitação de vaga em si). Candidato só pode ser
# cadastrado com a vaga já aprovada (não precisa esperar "criada no Senior").
candidato_bp = Blueprint("rh_candidato_bp", __name__, url_prefix="/rh")

VAGA_STATUS_ACEITA_CANDIDATO = ("APROVADA", "VAGA_CRIADA")


def _is_rh(session, user_id, role):
    """Mesma checagem de rh/vaga_routes.py::_is_rh, duplicada de propósito
    pra evitar import cruzado entre módulos rh/* (convenção já usada em
    rh/attachment_service.py)."""
    if role == "ADMIN":
        return True
    department_id = get_user_department_id(session, user_id)
    if department_id is None:
        return False
    dept = session.query(LegacyDepartment).get(department_id)
    return bool(dept and dept.name.strip().casefold() == "rh")


def _serialize_candidato(session, c):
    return {
        "id": c.id,
        "vaga_id": c.vaga_id,
        "nome": c.nome,
        "email": c.email,
        "telefone": c.telefone,
        "origem": c.origem,
        "etapa": c.etapa,
        "motivo_reprovacao": c.motivo_reprovacao,
        "order": c.order,
        "created_by": user_brief(session, c.created_by),
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _serialize_comentario(session, com):
    return {
        "id": com.id,
        "candidato_id": com.candidato_id,
        "body": com.body,
        "author": user_brief(session, com.author_id),
        "created_at": com.created_at.isoformat() if com.created_at else None,
    }


@candidato_bp.route("/vagas/<string:vaga_id>/candidatos", methods=["GET"])
@jwt_required()
def list_candidatos(vaga_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        if not _is_rh(session, user_id, role):
            return jsonify({"success": False, "message": "Vaga não encontrada."}), 404
        vaga = session.query(VagaSolicitacao).get(vaga_id)
        if not vaga:
            return jsonify({"success": False, "message": "Vaga não encontrada."}), 404
        candidatos = (
            session.query(VagaCandidato)
            .filter(VagaCandidato.vaga_id == vaga_id)
            .order_by(VagaCandidato.etapa, VagaCandidato.order)
            .all()
        )
        return jsonify([_serialize_candidato(session, c) for c in candidatos]), 200
    finally:
        session.close()


@candidato_bp.route("/vagas/<string:vaga_id>/candidatos", methods=["POST"])
@jwt_required()
def create_candidato(vaga_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    data = request.get_json() or {}
    session = SessionLocal()
    try:
        if not _is_rh(session, user_id, role):
            return jsonify({"success": False, "message": "Vaga não encontrada."}), 404
        vaga = session.query(VagaSolicitacao).get(vaga_id)
        if not vaga:
            return jsonify({"success": False, "message": "Vaga não encontrada."}), 404
        if vaga.status not in VAGA_STATUS_ACEITA_CANDIDATO:
            return jsonify({
                "success": False,
                "message": "Só é possível cadastrar candidato numa vaga aprovada.",
            }), 409

        nome = (data.get("nome") or "").strip()
        if len(nome) < 2:
            return jsonify({"success": False, "message": "Informe o nome do candidato."}), 422

        max_order = (
            session.query(VagaCandidato)
            .filter(VagaCandidato.vaga_id == vaga_id, VagaCandidato.etapa == "TRIAGEM")
            .count()
        )
        candidato = VagaCandidato(
            vaga_id=vaga_id,
            nome=nome,
            email=(data.get("email") or "").strip() or None,
            telefone=(data.get("telefone") or "").strip() or None,
            origem=(data.get("origem") or "").strip() or None,
            created_by=user_id,
            order=max_order,
        )
        session.add(candidato)
        session.commit()
        return jsonify({"success": True, "candidato": _serialize_candidato(session, candidato)}), 201
    finally:
        session.close()


@candidato_bp.route("/candidatos/<string:candidato_id>", methods=["PATCH"])
@jwt_required()
def update_candidato(candidato_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    data = request.get_json() or {}
    session = SessionLocal()
    try:
        if not _is_rh(session, user_id, role):
            return jsonify({"success": False, "message": "Candidato não encontrado."}), 404
        candidato = session.query(VagaCandidato).get(candidato_id)
        if not candidato:
            return jsonify({"success": False, "message": "Candidato não encontrado."}), 404

        if "nome" in data:
            nome = (data.get("nome") or "").strip()
            if len(nome) < 2:
                return jsonify({"success": False, "message": "Informe o nome do candidato."}), 422
            candidato.nome = nome
        if "email" in data:
            candidato.email = (data.get("email") or "").strip() or None
        if "telefone" in data:
            candidato.telefone = (data.get("telefone") or "").strip() or None
        if "origem" in data:
            candidato.origem = (data.get("origem") or "").strip() or None
        if "motivo_reprovacao" in data:
            candidato.motivo_reprovacao = (data.get("motivo_reprovacao") or "").strip() or None
        if "etapa" in data:
            etapa = data.get("etapa")
            if etapa not in CANDIDATO_ETAPAS:
                return jsonify({"success": False, "message": "Etapa inválida."}), 422
            candidato.etapa = etapa
        if "order" in data:
            try:
                candidato.order = int(data.get("order"))
            except (TypeError, ValueError):
                return jsonify({"success": False, "message": "Posição inválida."}), 422

        session.commit()
        return jsonify({"success": True, "candidato": _serialize_candidato(session, candidato)}), 200
    finally:
        session.close()


@candidato_bp.route("/candidatos/<string:candidato_id>", methods=["DELETE"])
@jwt_required()
def delete_candidato(candidato_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        if not _is_rh(session, user_id, role):
            return jsonify({"success": False, "message": "Candidato não encontrado."}), 404
        candidato = session.query(VagaCandidato).get(candidato_id)
        if not candidato:
            return jsonify({"success": False, "message": "Candidato não encontrado."}), 404
        session.delete(candidato)
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@candidato_bp.route("/candidatos/<string:candidato_id>/comentarios", methods=["GET"])
@jwt_required()
def list_comentarios(candidato_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    session = SessionLocal()
    try:
        if not _is_rh(session, user_id, role):
            return jsonify({"success": False, "message": "Candidato não encontrado."}), 404
        candidato = session.query(VagaCandidato).get(candidato_id)
        if not candidato:
            return jsonify({"success": False, "message": "Candidato não encontrado."}), 404
        comentarios = (
            session.query(VagaCandidatoComentario)
            .filter(VagaCandidatoComentario.candidato_id == candidato_id)
            .order_by(VagaCandidatoComentario.created_at)
            .all()
        )
        return jsonify([_serialize_comentario(session, c) for c in comentarios]), 200
    finally:
        session.close()


@candidato_bp.route("/candidatos/<string:candidato_id>/comentarios", methods=["POST"])
@jwt_required()
def create_comentario(candidato_id):
    user_id = int(get_jwt_identity())
    role = get_current_role()
    body = (request.get_json() or {}).get("body")
    session = SessionLocal()
    try:
        if not _is_rh(session, user_id, role):
            return jsonify({"success": False, "message": "Candidato não encontrado."}), 404
        candidato = session.query(VagaCandidato).get(candidato_id)
        if not candidato:
            return jsonify({"success": False, "message": "Candidato não encontrado."}), 404
        body = (body or "").strip()
        if not body:
            return jsonify({"success": False, "message": "Comentário vazio."}), 422
        comentario = VagaCandidatoComentario(candidato_id=candidato_id, author_id=user_id, body=body)
        session.add(comentario)
        session.commit()
        return jsonify({"success": True, "comentario": _serialize_comentario(session, comentario)}), 201
    finally:
        session.close()

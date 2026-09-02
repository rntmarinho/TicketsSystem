from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.gestao_db import SessionLocal
from services.auth_decorators import get_current_role
from services.gestao_permissions import can_access_gestao, can_manage_org_structure, is_nucleo_manager, STAFF_ROLES
from gestao.models.nucleo_models import Nucleo, NucleoMembro, NucleoGerente
from gestao.models.legacy import LegacyUser
from gestao.audit_log import record as audit_record

nucleo_bp = Blueprint("gestao_nucleo_bp", __name__, url_prefix="/gestao")


def _guard():
    role = get_current_role()
    if not can_access_gestao(role):
        return None, None, (jsonify({"success": False, "message": "Seu perfil não tem acesso ao módulo de gestão."}), 403)
    return int(get_jwt_identity()), role, None


def _serialize_nucleo(session, nucleo):
    membros = (
        session.query(LegacyUser.id, LegacyUser.name)
        .join(NucleoMembro, NucleoMembro.user_id == LegacyUser.id)
        .filter(NucleoMembro.nucleo_id == nucleo.id)
        .all()
    )
    gerentes = (
        session.query(LegacyUser.id, LegacyUser.name)
        .join(NucleoGerente, NucleoGerente.user_id == LegacyUser.id)
        .filter(NucleoGerente.nucleo_id == nucleo.id)
        .all()
    )
    return {
        "id": nucleo.id,
        "name": nucleo.name,
        "description": nucleo.description,
        "membros": [{"id": m[0], "name": m[1]} for m in membros],
        "gerentes": [{"id": g[0], "name": g[1]} for g in gerentes],
    }


@nucleo_bp.route("/nucleos", methods=["GET"])
@jwt_required()
def list_nucleos():
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        nucleos = session.query(Nucleo).order_by(Nucleo.name.asc()).all()
        return jsonify([_serialize_nucleo(session, n) for n in nucleos]), 200
    finally:
        session.close()


@nucleo_bp.route("/nucleos", methods=["POST"])
@jwt_required()
def create_nucleo():
    user_id, role, err = _guard()
    if err:
        return err
    if not can_manage_org_structure(role):
        return jsonify({"success": False, "message": "Só admin ou diretor pode criar núcleos."}), 403
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if len(name) < 2 or len(name) > 100:
        return jsonify({"success": False, "message": "Nome do núcleo deve ter entre 2 e 100 caracteres."}), 422
    session = SessionLocal()
    try:
        existing = session.query(Nucleo).filter(Nucleo.name == name).first()
        if existing:
            return jsonify({"success": True, "nucleo": _serialize_nucleo(session, existing)}), 200
        nucleo = Nucleo(name=name, description=data.get("description"))
        session.add(nucleo)
        session.flush()
        audit_record(session, user_id, "criar_nucleo", "Nucleo", nucleo.id, {"name": name})
        session.commit()
        return jsonify({"success": True, "nucleo": _serialize_nucleo(session, nucleo)}), 201
    finally:
        session.close()


@nucleo_bp.route("/nucleos/<string:nucleo_id>", methods=["PATCH"])
@jwt_required()
def update_nucleo(nucleo_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        nucleo = session.query(Nucleo).get(nucleo_id)
        if not nucleo:
            return jsonify({"success": False, "message": "Núcleo não encontrado."}), 404
        if not is_nucleo_manager(session, user_id, role, nucleo_id):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        data = request.get_json() or {}
        if "name" in data:
            name = (data["name"] or "").strip()
            if len(name) < 2 or len(name) > 100:
                return jsonify({"success": False, "message": "Nome do núcleo deve ter entre 2 e 100 caracteres."}), 422
            nucleo.name = name
        if "description" in data:
            nucleo.description = data["description"]
        session.commit()
        return jsonify({"success": True, "nucleo": _serialize_nucleo(session, nucleo)}), 200
    finally:
        session.close()


@nucleo_bp.route("/nucleos/<string:nucleo_id>", methods=["DELETE"])
@jwt_required()
def delete_nucleo(nucleo_id):
    user_id, role, err = _guard()
    if err:
        return err
    if not can_manage_org_structure(role):
        return jsonify({"success": False, "message": "Só admin ou diretor pode remover núcleos."}), 403
    session = SessionLocal()
    try:
        nucleo = session.query(Nucleo).get(nucleo_id)
        if not nucleo:
            return jsonify({"success": False, "message": "Núcleo não encontrado."}), 404
        audit_record(session, user_id, "remover_nucleo", "Nucleo", nucleo.id, {"name": nucleo.name})
        session.delete(nucleo)
        session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@nucleo_bp.route("/nucleos/<string:nucleo_id>/membros", methods=["POST"])
@jwt_required()
def add_nucleo_membro(nucleo_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        if not is_nucleo_manager(session, user_id, role, nucleo_id):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        target_user_id = (request.get_json() or {}).get("user_id")
        existing = (
            session.query(NucleoMembro)
            .filter(NucleoMembro.nucleo_id == nucleo_id, NucleoMembro.user_id == target_user_id)
            .first()
        )
        if not existing:
            session.add(NucleoMembro(nucleo_id=nucleo_id, user_id=target_user_id))
            session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@nucleo_bp.route("/nucleos/<string:nucleo_id>/membros/<int:target_user_id>", methods=["DELETE"])
@jwt_required()
def remove_nucleo_membro(nucleo_id, target_user_id):
    user_id, role, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        if not is_nucleo_manager(session, user_id, role, nucleo_id):
            return jsonify({"success": False, "message": "Sem permissão."}), 403
        row = (
            session.query(NucleoMembro)
            .filter(NucleoMembro.nucleo_id == nucleo_id, NucleoMembro.user_id == target_user_id)
            .first()
        )
        if row:
            session.delete(row)
            session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@nucleo_bp.route("/nucleos/<string:nucleo_id>/gerentes", methods=["POST"])
@jwt_required()
def add_nucleo_gerente(nucleo_id):
    user_id, role, err = _guard()
    if err:
        return err
    if not can_manage_org_structure(role):
        return jsonify({"success": False, "message": "Só admin ou diretor pode definir gerente de núcleo."}), 403
    session = SessionLocal()
    try:
        target_user_id = (request.get_json() or {}).get("user_id")
        existing = (
            session.query(NucleoGerente)
            .filter(NucleoGerente.nucleo_id == nucleo_id, NucleoGerente.user_id == target_user_id)
            .first()
        )
        if not existing:
            session.add(NucleoGerente(nucleo_id=nucleo_id, user_id=target_user_id))
            session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@nucleo_bp.route("/nucleos/<string:nucleo_id>/gerentes/<int:target_user_id>", methods=["DELETE"])
@jwt_required()
def remove_nucleo_gerente(nucleo_id, target_user_id):
    user_id, role, err = _guard()
    if err:
        return err
    if not can_manage_org_structure(role):
        return jsonify({"success": False, "message": "Só admin ou diretor pode remover gerente de núcleo."}), 403
    session = SessionLocal()
    try:
        row = (
            session.query(NucleoGerente)
            .filter(NucleoGerente.nucleo_id == nucleo_id, NucleoGerente.user_id == target_user_id)
            .first()
        )
        if row:
            session.delete(row)
            session.commit()
        return jsonify({"success": True}), 200
    finally:
        session.close()


@nucleo_bp.route("/organograma", methods=["GET"])
@jwt_required()
def organograma():
    """Lista plana de todo o staff com cargo/ramal/whatsapp/nível/gestor imediato/núcleo
    — o frontend monta a árvore a partir de gestor_imediato_id."""
    _, _, err = _guard()
    if err:
        return err
    session = SessionLocal()
    try:
        users = (
            session.query(LegacyUser)
            .filter(LegacyUser.access_type.in_(STAFF_ROLES), LegacyUser.situation == "A")
            .order_by(LegacyUser.name.asc())
            .all()
        )
        nucleo_by_user = dict(
            session.query(NucleoMembro.user_id, NucleoMembro.nucleo_id).all()
        )
        nucleo_names = dict(session.query(Nucleo.id, Nucleo.name).all())
        result = []
        for u in users:
            nucleo_id = nucleo_by_user.get(u.id)
            result.append({
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "access_type": u.access_type,
                "cargo": u.cargo,
                "ramal": u.ramal,
                "whatsapp": u.whatsapp,
                "nivel_hierarquico": u.nivel_hierarquico,
                "gestor_imediato_id": u.gestor_imediato_id,
                "nucleo": {"id": nucleo_id, "name": nucleo_names.get(nucleo_id)} if nucleo_id else None,
            })
        return jsonify(result), 200
    finally:
        session.close()

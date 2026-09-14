from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.auth_decorators import get_current_role
from notes.note_controller import NoteController

# Módulo de Anotações — aberto a qualquer usuário autenticado desde 09/09/2026
# (antes era exclusivo de admin/técnico). Restrito por setor dentro do próprio
# controller/model (note_controller.py::_check_access), sem exceção nem pra
# ADMIN. VISUALIZADOR só lê (papel de oversight, mesmo tratamento dado a
# tarefas/projetos/aprovações em outros módulos).
note_bp = Blueprint("note_bp", __name__, url_prefix="/notes")


def _block_visualizador():
    if get_current_role() == "VISUALIZADOR":
        return jsonify({"success": False, "message": "Seu perfil é somente leitura em Anotações."}), 403
    return None


@note_bp.route("/", methods=["GET"])
@jwt_required()
def list_notes():
    scope = request.args.get("scope", "pessoal")
    response, status = NoteController.list_notes(scope, int(get_jwt_identity()))
    return jsonify(response), status


@note_bp.route("/", methods=["POST"])
@jwt_required()
def create_note():
    err = _block_visualizador()
    if err:
        return err
    data = request.get_json()
    response, status = NoteController.create_note(data, int(get_jwt_identity()))
    return jsonify(response), status


@note_bp.route("/<int:note_id>", methods=["PUT"])
@jwt_required()
def update_note(note_id):
    err = _block_visualizador()
    if err:
        return err
    data = request.get_json()
    response, status = NoteController.update_note(note_id, data, int(get_jwt_identity()))
    return jsonify(response), status


@note_bp.route("/<int:note_id>", methods=["DELETE"])
@jwt_required()
def delete_note(note_id):
    err = _block_visualizador()
    if err:
        return err
    response, status = NoteController.delete_note(note_id, int(get_jwt_identity()))
    return jsonify(response), status

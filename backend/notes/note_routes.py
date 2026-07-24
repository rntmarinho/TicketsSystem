from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.auth_decorators import require_role
from notes.note_controller import NoteController

# Módulo de Anotações — exclusivo de admin/técnico (cliente e viewer não
# têm nenhum acesso, nem de leitura).
note_bp = Blueprint("note_bp", __name__, url_prefix="/notes")


@note_bp.route("/", methods=["GET"])
@require_role("admin", "technician")
def list_notes():
    scope = request.args.get("scope", "pessoal")
    response, status = NoteController.list_notes(scope, int(get_jwt_identity()))
    return jsonify(response), status


@note_bp.route("/", methods=["POST"])
@require_role("admin", "technician")
def create_note():
    data = request.get_json()
    response, status = NoteController.create_note(data, int(get_jwt_identity()))
    return jsonify(response), status


@note_bp.route("/<int:note_id>", methods=["PUT"])
@require_role("admin", "technician")
def update_note(note_id):
    data = request.get_json()
    response, status = NoteController.update_note(note_id, data, int(get_jwt_identity()))
    return jsonify(response), status


@note_bp.route("/<int:note_id>", methods=["DELETE"])
@require_role("admin", "technician")
def delete_note(note_id):
    response, status = NoteController.delete_note(note_id, int(get_jwt_identity()))
    return jsonify(response), status

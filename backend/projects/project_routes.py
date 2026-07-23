from flask import Blueprint, request, jsonify
from projects.project_controller import ProjectController
from services.auth_decorators import require_role

project_bp = Blueprint(
    "project_bp",
    __name__,
    url_prefix="/projects"
)

# Criar projeto — decisão de gestão, só admin
@project_bp.route("/", methods=["POST"])
@require_role("admin")
def create_project():
    data = request.get_json()
    response, status = ProjectController.create_project(data)
    return jsonify(response), status

# Listar projetos — technician também precisa pra vincular tarefa a um
# projeto; viewer só enxerga (tela de Projetos é leitura pra esse papel)
@project_bp.route("/", methods=["GET"])
@require_role("admin", "technician", "viewer")
def list_projects():
    response, status = ProjectController.list_projects()
    return jsonify(response), status

@project_bp.route("/<int:project_id>", methods=["GET"])
@require_role("admin", "technician", "viewer")
def get_project(project_id):
    response, status = ProjectController.get_project(project_id)
    return jsonify(response), status

@project_bp.route("/<int:project_id>", methods=["PUT"])
@require_role("admin")
def update_project(project_id):
    data = request.get_json()
    response, status = ProjectController.update_project(project_id, data)
    return jsonify(response), status

# Arquivar/reativar — decisão de gestão, só admin
@project_bp.route("/<int:project_id>/situation", methods=["PATCH"])
@require_role("admin")
def update_situation(project_id):
    data = request.get_json()
    response, status = ProjectController.update_status(project_id, data.get("status"))
    return jsonify(response), status

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from services.auth_decorators import require_role
from departments.department_controller import DepartmentController

department_bp = Blueprint(
    "department_bp",
    __name__,
    url_prefix="/departments"
)

# Criar departamento — configuração, mesmo padrão de categoria/prioridade (admin)
@department_bp.route("/", methods=["POST"])
@require_role("admin")
def create_department():
    data = request.get_json()
    response, status = DepartmentController.create_department(data)
    return jsonify(response), status

# Listar departamentos — usado no cadastro/edição de usuário
@department_bp.route("/", methods=["GET"])
@jwt_required()
def list_departments():
    response, status = DepartmentController.list_departments()
    return jsonify(response), status

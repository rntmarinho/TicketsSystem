from gestao.models.field_models import CustomField, CUSTOM_FIELD_TYPES
from gestao.models.project_models import Project
from gestao.serializers import serialize_custom_field
from services.gestao_permissions import can_manage_team


def list_fields(session, project_id):
    fields = (
        session.query(CustomField)
        .filter(CustomField.project_id == project_id)
        .order_by(CustomField.order.asc())
        .all()
    )
    return [serialize_custom_field(f) for f in fields], 200


def create_field(session, user_id, role, project_id, data):
    project = session.query(Project).get(project_id)
    if not project:
        return {"success": False, "message": "Projeto não encontrado."}, 404
    if not can_manage_team(session, user_id, role, project.team_id):
        return {"success": False, "message": "Sem permissão."}, 403

    name = (data.get("name") or "").strip()
    field_type = data.get("type")
    if not name:
        return {"success": False, "message": "Nome do campo é obrigatório."}, 422
    if field_type not in CUSTOM_FIELD_TYPES:
        return {"success": False, "message": "Tipo de campo inválido."}, 422

    max_order = (
        session.query(CustomField.order)
        .filter(CustomField.project_id == project_id)
        .order_by(CustomField.order.desc())
        .first()
    )
    field = CustomField(
        project_id=project_id,
        name=name,
        type=field_type,
        options=data.get("options"),
        order=(max_order[0] + 1) if max_order else 0,
    )
    session.add(field)
    session.commit()
    return {"success": True, "field": serialize_custom_field(field)}, 201


def update_field(session, user_id, role, field_id, data):
    field = session.query(CustomField).get(field_id)
    if not field:
        return {"success": False, "message": "Campo não encontrado."}, 404
    project = session.query(Project).get(field.project_id)
    if not can_manage_team(session, user_id, role, project.team_id):
        return {"success": False, "message": "Sem permissão."}, 403

    if "name" in data:
        field.name = (data["name"] or "").strip()
    if "options" in data:
        field.options = data["options"]
    if "order" in data:
        field.order = data["order"]
    session.commit()
    return {"success": True, "field": serialize_custom_field(field)}, 200


def delete_field(session, user_id, role, field_id):
    field = session.query(CustomField).get(field_id)
    if not field:
        return {"success": False, "message": "Campo não encontrado."}, 404
    project = session.query(Project).get(field.project_id)
    if not can_manage_team(session, user_id, role, project.team_id):
        return {"success": False, "message": "Sem permissão."}, 403
    session.delete(field)
    session.commit()
    return {"success": True}, 200

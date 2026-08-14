"""Serialização compartilhada dos modelos do módulo de gestão pra JSON."""
from database.gestao_db import SessionLocal
from gestao.models.legacy import LegacyUser

_user_cache_key = "_gestao_user_cache"


def _iso(dt):
    return dt.isoformat() if dt else None


def user_brief(session, user_id):
    if user_id is None:
        return None
    user = session.query(LegacyUser).get(user_id)
    if not user:
        return None
    return {"id": user.id, "name": user.name, "email": user.email}


def serialize_project(session, project, percent_complete=None, overdue_count=None):
    data = {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "team_id": project.team_id,
        "owner": user_brief(session, project.owner_id),
        "approver": user_brief(session, project.approver_id),
        "approval_status": project.approval_status,
        "start_date": _iso(project.start_date),
        "end_date": _iso(project.end_date),
        "actual_started_at": _iso(project.actual_started_at),
        "actual_ended_at": _iso(project.actual_ended_at),
        "kanban_columns": project.kanban_columns,
        "horizon": project.horizon,
        "orcamento": project.orcamento,
        "created_at": _iso(project.created_at),
        "updated_at": _iso(project.updated_at),
    }
    if percent_complete is not None:
        data["percent_complete"] = percent_complete
    if overdue_count is not None:
        data["overdue_count"] = overdue_count
    return data


def serialize_task(session, task, include_subtasks=True, include_counts=True):
    data = {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "start_date": _iso(task.start_date),
        "due_date": _iso(task.due_date),
        "duration_days": task.duration_days,
        "is_entrega": task.is_entrega,
        "is_rotina": task.is_rotina,
        "rotina_frequencia": task.rotina_frequencia,
        "rotina_ate_data": _iso(task.rotina_ate_data),
        "rotina_group_id": task.rotina_group_id,
        "order": task.order,
        "project_id": task.project_id,
        "assignee": user_brief(session, task.assignee_id),
        "assignee_id": task.assignee_id,
        "parent_task_id": task.parent_task_id,
        "locked": task.locked,
        "actual_started_at": _iso(task.actual_started_at),
        "actual_ended_at": _iso(task.actual_ended_at),
        "created_at": _iso(task.created_at),
        "updated_at": _iso(task.updated_at),
        "custom_field_values": {v.custom_field_id: v.value for v in task.custom_field_values},
        "predecessor_links": [
            {"id": d.id, "predecessor_id": d.predecessor_id, "type": d.type, "lag_days": d.lag_days,
             "predecessor_title": d.predecessor.title if d.predecessor else None}
            for d in task.predecessor_links
        ],
    }
    if include_counts:
        data["attachment_count"] = len(task.attachments)
        data["comment_count"] = len(task.comments)
        data["subtask_count"] = len(task.subtasks)
    if include_subtasks:
        data["subtasks"] = [serialize_task(session, st, include_subtasks=False, include_counts=False) for st in task.subtasks]
    return data


def serialize_task_comment(session, comment):
    return {
        "id": comment.id,
        "task_id": comment.task_id,
        "body": comment.body,
        "author": user_brief(session, comment.author_id),
        "created_at": _iso(comment.created_at),
    }


def serialize_custom_field(field):
    return {
        "id": field.id,
        "project_id": field.project_id,
        "name": field.name,
        "type": field.type,
        "options": field.options,
        "order": field.order,
    }


def serialize_attachment(session, attachment):
    return {
        "id": attachment.id,
        "task_id": attachment.task_id,
        "project_id": attachment.project_id,
        "file_name": attachment.file_name,
        "file_size": attachment.file_size,
        "mime_type": attachment.mime_type,
        "uploaded_by": user_brief(session, attachment.uploaded_by),
        "uploaded_at": _iso(attachment.uploaded_at),
    }


def serialize_folder(folder):
    return {
        "id": folder.id,
        "name": folder.name,
        "project_id": folder.project_id,
        "parent_id": folder.parent_id,
        "created_by": folder.created_by,
        "created_at": _iso(folder.created_at),
    }


def serialize_team(team):
    return {"id": team.id, "name": team.name, "description": team.description}

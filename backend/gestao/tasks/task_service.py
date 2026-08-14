import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import or_
from gestao.models.task_models import Task, TaskDependency, TaskComment, TASK_STATUSES, TASK_PRIORITIES, DEPENDENCY_TYPES
from gestao.models.field_models import TaskCustomFieldValue
from gestao.models.project_models import Project
from gestao.serializers import serialize_task, serialize_task_comment
from services.gestao_permissions import (
    visible_project_team_ids, can_modify_task, can_delete_task, can_manage_team,
)
from services.reschedule import reschedule_and_persist
from services.rotina import generate_rotina_occurrences
from gestao.notify import notify


def _visible_project_ids(session, user_id, role):
    """None = sem filtro (vê todo projeto). Lista (possivelmente vazia) = só esses projetos."""
    team_ids = visible_project_team_ids(session, user_id, role)
    if team_ids is None:
        return None
    if not team_ids:
        return []
    rows = session.query(Project.id).filter(Project.team_id.in_(team_ids)).all()
    return [r[0] for r in rows]


def list_tasks(session, user_id, role, project_id=None, assignee_id=None, only_top_level=False):
    query = session.query(Task)

    visible_ids = _visible_project_ids(session, user_id, role)
    if visible_ids is not None:
        # Além dos projetos visíveis, a pessoa sempre vê as tarefas atribuídas a ela mesma
        # (mesmo em projeto de equipe da qual não participa) — mesma regra do APPCNS.
        query = query.filter(or_(Task.project_id.in_(visible_ids), Task.assignee_id == user_id))

    if project_id:
        query = query.filter(Task.project_id == project_id)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if only_top_level:
        query = query.filter(Task.parent_task_id.is_(None))

    tasks = query.order_by(Task.order.asc(), Task.created_at.asc()).all()
    return [serialize_task(session, t) for t in tasks]


def _next_order(session, project_id):
    from sqlalchemy import func
    query = session.query(func.max(Task.order)).filter(Task.project_id == project_id) if project_id \
        else session.query(func.max(Task.order)).filter(Task.project_id.is_(None))
    current_max = query.scalar()
    return (current_max or 0) + 1


def create_task(session, user_id, role, data):
    if role in ("CLIENTE", "VISUALIZADOR"):
        return {"success": False, "message": "Seu perfil não pode criar tarefas."}, 403

    title = (data.get("title") or "").strip()
    if len(title) < 2 or len(title) > 200:
        return {"success": False, "message": "Título deve ter entre 2 e 200 caracteres."}, 422

    priority = data.get("priority", "MEDIA")
    if priority not in TASK_PRIORITIES:
        return {"success": False, "message": "Prioridade inválida."}, 422

    project_id = data.get("project_id")

    # Tarefa recorrente: gera N ocorrências, cada uma com seu próprio título/data,
    # todas compartilhando um rotina_group_id — sem reagendamento em cascata (são
    # tarefas independentes entre si, não uma rede de dependências).
    if data.get("is_rotina") and data.get("rotina_frequencia") and data.get("rotina_ate_data"):
        start = data.get("start_date") or datetime.now(timezone.utc)
        occurrences = generate_rotina_occurrences(start, data["rotina_ate_data"], data["rotina_frequencia"])
        if not occurrences:
            return {"success": False, "message": "O período informado não gera nenhuma ocorrência."}, 422

        duration = data.get("duration_days") or 0
        rotina_group_id = str(uuid.uuid4())
        base_order = _next_order(session, project_id)
        created = []
        for i, occ_date in enumerate(occurrences):
            occ_end = occ_date + timedelta(days=duration)
            label = occ_date.strftime("%d/%m")
            task = Task(
                title=f"{title} — {label}",
                description=data.get("description"),
                project_id=project_id,
                parent_task_id=data.get("parent_task_id"),
                assignee_id=data.get("assignee_id"),
                priority=priority,
                is_entrega=bool(data.get("is_entrega")),
                is_rotina=True,
                rotina_frequencia=data["rotina_frequencia"],
                rotina_group_id=rotina_group_id,
                start_date=occ_date,
                due_date=occ_end,
                duration_days=duration,
                order=base_order + i,
                created_by=user_id,
            )
            session.add(task)
            created.append(task)
        session.commit()
        return {"generated": len(created), "tasks": [serialize_task(session, t) for t in created], "rotina_group_id": rotina_group_id}, 201

    order = _next_order(session, project_id)
    task = Task(
        title=title,
        description=data.get("description"),
        project_id=project_id,
        parent_task_id=data.get("parent_task_id"),
        assignee_id=data.get("assignee_id"),
        priority=priority,
        start_date=data.get("start_date"),
        due_date=data.get("due_date"),
        duration_days=data.get("duration_days"),
        is_entrega=bool(data.get("is_entrega")),
        order=order,
        created_by=user_id,
    )
    session.add(task)
    session.flush()

    if data.get("duration_days") is not None and task.project_id:
        reschedule_and_persist(session, task.project_id)

    if task.assignee_id and task.assignee_id != user_id:
        notify(session, task.assignee_id, f"Você foi atribuído à tarefa \"{task.title}\"", type="TAREFA_ATRIBUIDA", link=f"/gestao/projetos/{task.project_id}" if task.project_id else None)

    session.commit()
    return {"success": True, "task": serialize_task(session, task)}, 201


def get_task(session, task_id):
    task = session.query(Task).get(task_id)
    if not task:
        return {"success": False, "message": "Tarefa não encontrada."}, 404
    data = serialize_task(session, task)
    data["comments"] = [serialize_task_comment(session, c) for c in task.comments]
    return data, 200


def _has_cycle_in_subtask_tree(session, task_id, new_parent_id):
    """Impede que `new_parent_id` seja um descendente de `task_id` (criaria ciclo)."""
    cursor = new_parent_id
    while cursor:
        if cursor == task_id:
            return True
        ancestor = session.query(Task.parent_task_id).filter(Task.id == cursor).first()
        cursor = ancestor[0] if ancestor else None
    return False


def update_task(session, user_id, role, task_id, data):
    task = session.query(Task).get(task_id)
    if not task:
        return {"success": False, "message": "Tarefa não encontrada."}, 404

    is_assignee = task.assignee_id == user_id
    if not can_modify_task(role, is_assignee, task.locked):
        return {"success": False, "message": "Sem permissão para alterar esta tarefa."}, 403

    if "locked" in data and data["locked"] != task.locked and role not in ("ADMIN", "GESTOR_PROJETO"):
        return {"success": False, "message": "Só Admin ou Gestor de Projeto pode travar/destravar tarefa."}, 403

    if data.get("parent_task_id"):
        if data["parent_task_id"] == task.id:
            return {"success": False, "message": "Uma tarefa não pode ser subtarefa dela mesma."}, 422
        if _has_cycle_in_subtask_tree(session, task.id, data["parent_task_id"]):
            return {"success": False, "message": "Isso criaria um ciclo entre tarefa e subtarefa."}, 422

    if "title" in data:
        title = (data["title"] or "").strip()
        if len(title) < 2 or len(title) > 200:
            return {"success": False, "message": "Título deve ter entre 2 e 200 caracteres."}, 422
        task.title = title
    if "description" in data:
        task.description = data["description"]
    if "priority" in data:
        if data["priority"] not in TASK_PRIORITIES:
            return {"success": False, "message": "Prioridade inválida."}, 422
        task.priority = data["priority"]
    if "assignee_id" in data:
        assignee_changed = data["assignee_id"] != task.assignee_id
        task.assignee_id = data["assignee_id"]
        if assignee_changed and task.assignee_id and task.assignee_id != user_id:
            notify(session, task.assignee_id, f"Você foi atribuído à tarefa \"{task.title}\"", type="TAREFA_ATRIBUIDA", link=f"/gestao/projetos/{task.project_id}" if task.project_id else None)
    if "parent_task_id" in data:
        task.parent_task_id = data["parent_task_id"]
    if "is_entrega" in data:
        task.is_entrega = bool(data["is_entrega"])
    if "locked" in data:
        task.locked = bool(data["locked"])

    if "status" in data and data["status"] != task.status:
        if data["status"] not in TASK_STATUSES:
            return {"success": False, "message": "Status inválido."}, 422
        now = datetime.now(timezone.utc)
        if data["status"] == "FAZENDO" and not task.actual_started_at:
            task.actual_started_at = now
        if data["status"] == "FEITO":
            task.actual_ended_at = now
            if not task.actual_started_at:
                task.actual_started_at = now
        elif task.status == "FEITO":
            task.actual_ended_at = None
        task.status = data["status"]

    affects_schedule = "duration_days" in data or "start_date" in data or "due_date" in data
    if "duration_days" in data:
        task.duration_days = data["duration_days"]
    if "start_date" in data:
        task.start_date = data["start_date"]
    if "due_date" in data:
        task.due_date = data["due_date"]

    custom_field_values = data.get("custom_field_values")
    if custom_field_values:
        for field_id, value in custom_field_values.items():
            existing = (
                session.query(TaskCustomFieldValue)
                .filter(TaskCustomFieldValue.task_id == task.id, TaskCustomFieldValue.custom_field_id == field_id)
                .first()
            )
            if existing:
                existing.value = value
            else:
                session.add(TaskCustomFieldValue(task_id=task.id, custom_field_id=field_id, value=value))

    session.flush()
    if affects_schedule and task.project_id:
        reschedule_and_persist(session, task.project_id)

    session.commit()
    return {"success": True, "task": serialize_task(session, task)}, 200


def delete_task(session, role, task_id):
    if not can_delete_task(role):
        return {"success": False, "message": "Só Admin ou Gestor de Projeto pode excluir tarefas."}, 403
    task = session.query(Task).get(task_id)
    if not task:
        return {"success": False, "message": "Tarefa não encontrada."}, 404
    if task.locked:
        return {"success": False, "message": "Tarefa travada — destrave antes de excluir."}, 403
    session.delete(task)
    session.commit()
    return {"success": True}, 200


def move_task(session, user_id, role, task_id, direction):
    task = session.query(Task).get(task_id)
    if not task:
        return {"success": False, "message": "Tarefa não encontrada."}, 404
    is_assignee = task.assignee_id == user_id
    if not can_modify_task(role, is_assignee, task.locked):
        return {"success": False, "message": "Sem permissão para alterar esta tarefa."}, 403

    siblings = (
        session.query(Task)
        .filter(Task.project_id == task.project_id, Task.parent_task_id == task.parent_task_id)
        .order_by(Task.order.asc(), Task.created_at.asc())
        .all()
    )
    # Renumera pra valores sequenciais distintos preservando a ordem atual — auto-corrige
    # tarefas antigas com `order` zerado/repetido, senão a troca vira um no-op.
    for i, s in enumerate(siblings):
        s.order = i

    index = next((i for i, s in enumerate(siblings) if s.id == task.id), -1)
    if index == -1:
        return {"success": False, "message": "Tarefa fora da lista."}, 409

    swap_index = index - 1 if direction == "up" else index + 1
    if swap_index < 0 or swap_index >= len(siblings):
        session.commit()
        return {"success": True, "moved": False}, 200

    siblings[index].order, siblings[swap_index].order = siblings[swap_index].order, siblings[index].order
    session.commit()
    return {"success": True, "moved": True}, 200


def _can_manage_schedule(session, user_id, role, task):
    if role == "ADMIN":
        return True
    if not task.project_id:
        return role == "GESTOR_PROJETO"
    project = session.query(Project).get(task.project_id)
    if not project:
        return False
    return can_manage_team(session, user_id, role, project.team_id)


def _has_path(from_id, to_id, adjacency):
    """BFS: existe caminho predecessor->sucessor de from_id até to_id? (detecta ciclo)."""
    visited = set()
    queue = [from_id]
    while queue:
        current = queue.pop(0)
        if current == to_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        queue.extend(adjacency.get(current, []))
    return False


def create_dependency(session, user_id, role, task_id, data):
    task = session.query(Task).get(task_id)
    if not task:
        return {"success": False, "message": "Tarefa não encontrada."}, 404
    if not _can_manage_schedule(session, user_id, role, task):
        return {"success": False, "message": "Sem permissão para editar dependências desta tarefa."}, 403

    predecessor_id = data.get("predecessor_id")
    dep_type = data.get("type", "FS")
    lag_days = data.get("lag_days", 0)
    if dep_type not in DEPENDENCY_TYPES:
        return {"success": False, "message": "Tipo de dependência inválido."}, 422
    if predecessor_id == task_id:
        return {"success": False, "message": "Uma tarefa não pode depender dela mesma."}, 422

    predecessor = session.query(Task).get(predecessor_id)
    if not predecessor:
        return {"success": False, "message": "Tarefa predecessora não encontrada."}, 404

    if task.project_id and predecessor.project_id and task.project_id != predecessor.project_id:
        return {"success": False, "message": "As duas tarefas precisam ser do mesmo projeto."}, 422

    all_links = session.query(TaskDependency.predecessor_id, TaskDependency.successor_id).all()
    adjacency = {}
    for pred_id, succ_id in all_links:
        adjacency.setdefault(pred_id, []).append(succ_id)

    if _has_path(task_id, predecessor_id, adjacency):
        return {"success": False, "message": "Isso criaria um ciclo de dependências."}, 422

    existing = (
        session.query(TaskDependency)
        .filter(TaskDependency.predecessor_id == predecessor_id, TaskDependency.successor_id == task_id)
        .first()
    )
    if existing:
        return {"success": False, "message": "Essa dependência já existe."}, 409

    dependency = TaskDependency(predecessor_id=predecessor_id, successor_id=task_id, type=dep_type, lag_days=lag_days)
    session.add(dependency)
    session.flush()
    if task.project_id:
        reschedule_and_persist(session, task.project_id)
    session.commit()

    return {
        "success": True,
        "dependency": {
            "id": dependency.id, "predecessor_id": predecessor_id, "successor_id": task_id,
            "type": dep_type, "lag_days": lag_days, "predecessor_title": predecessor.title,
        },
    }, 201


def delete_dependency(session, user_id, role, dependency_id):
    dependency = session.query(TaskDependency).get(dependency_id)
    if not dependency:
        return {"success": False, "message": "Dependência não encontrada."}, 404
    task = session.query(Task).get(dependency.successor_id)
    if not task or not _can_manage_schedule(session, user_id, role, task):
        return {"success": False, "message": "Sem permissão para editar dependências desta tarefa."}, 403
    project_id = task.project_id
    session.delete(dependency)
    session.flush()
    if project_id:
        reschedule_and_persist(session, project_id)
    session.commit()
    return {"success": True}, 200


def list_comments(session, task_id):
    task = session.query(Task).get(task_id)
    if not task:
        return {"success": False, "message": "Tarefa não encontrada."}, 404
    return [serialize_task_comment(session, c) for c in task.comments], 200


def create_comment(session, user_id, role, task_id, body):
    task = session.query(Task).get(task_id)
    if not task:
        return {"success": False, "message": "Tarefa não encontrada."}, 404
    body = (body or "").strip()
    if not body:
        return {"success": False, "message": "Comentário vazio."}, 422
    comment = TaskComment(task_id=task_id, author_id=user_id, body=body)
    session.add(comment)
    session.commit()
    return {"success": True, "comment": serialize_task_comment(session, comment)}, 201

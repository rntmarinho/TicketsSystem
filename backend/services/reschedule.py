"""
Porte de reschedule.ts (APPCNS) — recalcula inicio/termino das tarefas COM
predecessora, em cascata (ordem topologica), a partir da duracao informada e
do termino/inicio da(s) predecessora(s) -- "auto schedule" no espirito do
MS Project/Primavera. Tarefas sem predecessora nunca sao tocadas aqui (sao a
ancora manual do cronograma). Tarefas com predecessora so sao recalculadas se
tiverem duracao definida (`duration_days`, ou derivada de datas ja
existentes) -- sem duracao, ficam como estao.
"""
from collections import deque
from datetime import timedelta


def _add_days(dt, days):
    return dt + timedelta(days=days)


def _derived_duration(task):
    if task.get("duration_days") is not None:
        return task["duration_days"]
    if task.get("start_date") and task.get("due_date"):
        return max(0, round((task["due_date"] - task["start_date"]).total_seconds() / 86400))
    return None


def reschedule_project(tasks, dependencies):
    """
    tasks: lista de dicts {"id", "start_date": datetime|None, "due_date": datetime|None, "duration_days": int|None}
    dependencies: lista de dicts {"predecessor_id", "successor_id", "type", "lag_days"}

    Retorna dict {task_id: {"start_date": datetime, "due_date": datetime}} só
    com as tarefas cuja data deveria mudar.
    """
    by_id = {t["id"]: t for t in tasks}
    id_set = set(by_id.keys())
    preds_of, succs_of = {}, {}
    for d in dependencies:
        if d["predecessor_id"] not in id_set or d["successor_id"] not in id_set:
            continue
        preds_of.setdefault(d["successor_id"], []).append(d)
        succs_of.setdefault(d["predecessor_id"], []).append(d)

    in_degree = {t["id"]: len(preds_of.get(t["id"], [])) for t in tasks}
    queue = deque(t["id"] for t in tasks if in_degree.get(t["id"], 0) == 0)
    order = []
    seen = set()
    while queue:
        tid = queue.popleft()
        if tid in seen:
            continue
        seen.add(tid)
        order.append(tid)
        for d in succs_of.get(tid, []):
            in_degree[d["successor_id"]] -= 1
            if in_degree[d["successor_id"]] == 0:
                queue.append(d["successor_id"])

    resolved_start, resolved_end = {}, {}
    result = {}

    for tid in order:
        t = by_id[tid]
        preds = preds_of.get(tid, [])
        if not preds:
            # âncora manual: nunca mexe no início, mas se já tem início + duração, o
            # término segue a duração (mesmo pra tarefa raiz).
            root_duration = _derived_duration(t)
            if t.get("start_date") and root_duration is not None:
                new_end = _add_days(t["start_date"], root_duration)
                resolved_start[tid] = t["start_date"]
                resolved_end[tid] = new_end
                result[tid] = {"start_date": t["start_date"], "due_date": new_end}
            else:
                if t.get("start_date"):
                    resolved_start[tid] = t["start_date"]
                if t.get("due_date"):
                    resolved_end[tid] = t["due_date"]
            continue

        duration = _derived_duration(t)
        if duration is None:
            continue

        candidate_start = None
        for link in preds:
            pred_start = resolved_start.get(link["predecessor_id"])
            pred_end = resolved_end.get(link["predecessor_id"])
            if not pred_start or not pred_end:
                continue
            lag = link["lag_days"]
            if link["type"] == "FS":
                c = _add_days(pred_end, lag)
            elif link["type"] == "SS":
                c = _add_days(pred_start, lag)
            elif link["type"] == "FF":
                c = _add_days(pred_end, lag - duration)
            else:  # SF
                c = _add_days(pred_start, lag - duration)
            if candidate_start is None or c > candidate_start:
                candidate_start = c
        if candidate_start is None:
            continue

        new_end = _add_days(candidate_start, duration)
        resolved_start[tid] = candidate_start
        resolved_end[tid] = new_end
        result[tid] = {"start_date": candidate_start, "due_date": new_end}

    return result


def reschedule_and_persist(session, project_id):
    """
    Busca todas as tarefas + dependências do projeto, recalcula em cascata e
    persiste só o que mudou. Chamar depois de qualquer alteração que possa
    afetar o cronograma: duração/data de uma tarefa, ou criação/remoção de
    dependência. `session` já deve estar dentro de uma transação em andamento
    (nenhum commit é feito aqui — quem chama decide quando commitar).
    """
    from gestao.models.task_models import Task, TaskDependency

    tasks = session.query(Task).filter(Task.project_id == project_id).all()
    if not tasks:
        return

    task_dicts = [
        {"id": t.id, "start_date": t.start_date, "due_date": t.due_date, "duration_days": t.duration_days}
        for t in tasks
    ]
    task_ids = [t.id for t in tasks]
    deps = (
        session.query(TaskDependency)
        .filter(TaskDependency.successor_id.in_(task_ids))
        .all()
    )
    dep_dicts = [
        {"predecessor_id": d.predecessor_id, "successor_id": d.successor_id, "type": d.type, "lag_days": d.lag_days}
        for d in deps
    ]

    result = reschedule_project(task_dicts, dep_dicts)
    by_id = {t.id: t for t in tasks}

    for tid, dates in result.items():
        current = by_id[tid]
        changed_start = current.start_date is None or current.start_date != dates["start_date"]
        changed_end = current.due_date is None or current.due_date != dates["due_date"]
        if changed_start or changed_end:
            current.start_date = dates["start_date"]
            current.due_date = dates["due_date"]

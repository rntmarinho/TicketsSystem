"""
Porte de cpm.ts (APPCNS) — Metodo do Caminho Critico (CPM), no mesmo espirito
do MS Project / Primavera P6: cada tarefa tem uma duracao (fim planejado -
inicio planejado); dependencias entre tarefas tem um tipo (FS/SS/FF/SF) e uma
folga/antecedencia (lag, em dias).

O calculo roda num espaco de tempo PROPRIO (dia 0 = a data de inicio mais cedo
entre as tarefas sem predecessora), independente das datas reais planejadas --
isso responde "qual e o cronograma mais cedo/mais tarde POSSIVEL dado esta rede
de dependencias", que e depois comparado com a data real planejada de cada
tarefa pra detectar conflitos (tarefa planejada pra comecar antes que a rede
permita).
"""
from collections import deque


def _day_diff(later, earlier):
    return max(0, round((later - earlier).total_seconds() / 86400))


def compute_cpm(tasks, dependencies):
    """
    tasks: lista de dicts {"id": str, "start_date": datetime|None, "due_date": datetime|None}
    dependencies: lista de dicts {"predecessor_id", "successor_id", "type" (FS/SS/FF/SF), "lag_days"}

    Retorna dict:
      results: {task_id: {es, ef, ls, lf, float, duration, is_critical, planned_start_offset, has_conflict}}
      has_cycle: bool
      cycle_task_ids: list[str]
      project_duration_days: int
    """
    scheduled = [t for t in tasks if t.get("start_date") and t.get("due_date")]
    id_set = {t["id"] for t in scheduled}

    duration = {}
    planned_start = {}
    epoch = None
    for t in scheduled:
        start = t["start_date"]
        end = t["due_date"]
        d = _day_diff(end, start)
        duration[t["id"]] = d
        planned_start[t["id"]] = start
        if epoch is None or start < epoch:
            epoch = start

    results = {}
    if not scheduled or epoch is None:
        return {"results": results, "has_cycle": False, "cycle_task_ids": [], "project_duration_days": 0}

    valid_deps = [d for d in dependencies if d["predecessor_id"] in id_set and d["successor_id"] in id_set]
    preds_of = {}
    succs_of = {}
    for d in valid_deps:
        preds_of.setdefault(d["successor_id"], []).append(d)
        succs_of.setdefault(d["predecessor_id"], []).append(d)

    # Kahn's algorithm — ordenacao topologica, detecta ciclo se sobrar no
    in_degree = {t["id"]: 0 for t in scheduled}
    for d in valid_deps:
        in_degree[d["successor_id"]] = in_degree.get(d["successor_id"], 0) + 1
    queue = deque(t["id"] for t in scheduled if in_degree.get(t["id"], 0) == 0)
    order = []
    while queue:
        tid = queue.popleft()
        order.append(tid)
        for d in succs_of.get(tid, []):
            in_degree[d["successor_id"]] -= 1
            if in_degree[d["successor_id"]] == 0:
                queue.append(d["successor_id"])

    if len(order) != len(scheduled):
        cycle_task_ids = [t["id"] for t in scheduled if t["id"] not in order]
        return {"results": results, "has_cycle": True, "cycle_task_ids": cycle_task_ids, "project_duration_days": 0}

    # Passada pra frente: ES/EF
    es, ef = {}, {}
    for tid in order:
        dur = duration[tid]
        start = 0
        for d in preds_of.get(tid, []):
            p_es, p_ef = es[d["predecessor_id"]], ef[d["predecessor_id"]]
            lag = d["lag_days"]
            if d["type"] == "FS":
                constraint = p_ef + lag
            elif d["type"] == "SS":
                constraint = p_es + lag
            elif d["type"] == "FF":
                constraint = p_ef + lag - dur
            else:  # SF
                constraint = p_es + lag - dur
            start = max(start, constraint)
        es[tid] = start
        ef[tid] = start + dur

    project_end = max((ef[tid] for tid in order), default=0)

    # Passada pra tras: LS/LF
    ls, lf = {}, {}
    for tid in reversed(order):
        dur = duration[tid]
        succs = succs_of.get(tid, [])
        if succs:
            finish = float("inf")
            for d in succs:
                s_ls, s_lf = ls[d["successor_id"]], lf[d["successor_id"]]
                lag = d["lag_days"]
                if d["type"] == "FS":
                    constraint = s_ls - lag
                elif d["type"] == "SS":
                    constraint = s_ls - lag + dur
                elif d["type"] == "FF":
                    constraint = s_lf - lag
                else:  # SF
                    constraint = s_lf - lag + dur
                finish = min(finish, constraint)
        else:
            finish = project_end
        lf[tid] = finish
        ls[tid] = finish - dur

    for tid in order:
        float_val = ls[tid] - es[tid]
        # epoch = mínimo entre todos os starts agendados, então planned_start >= epoch sempre.
        planned_offset = _day_diff(planned_start[tid], epoch)
        results[tid] = {
            "es": es[tid],
            "ef": ef[tid],
            "ls": ls[tid],
            "lf": lf[tid],
            "float": float_val,
            "duration": duration[tid],
            "is_critical": float_val <= 0,
            "planned_start_offset": planned_offset,
            "has_conflict": planned_offset < es[tid],
        }

    return {"results": results, "has_cycle": False, "cycle_task_ids": [], "project_duration_days": project_end}

"""Porte de wbs.ts (APPCNS) — numeracao hierarquica estilo WBS (1, 1.1, 1.2, 2, 2.1...)."""


def build_wbs_hierarchy(tasks):
    """
    tasks: lista de dicts com pelo menos {"id": str, "parent_task_id": str|None}.
    Retorna lista de {"task": <item original>, "depth": int, "wbs": str}, na mesma
    ordem de inserção dos irmãos (não reordena por data/prioridade).
    """
    id_set = {t["id"] for t in tasks}
    by_parent = {}
    for t in tasks:
        parent = t.get("parent_task_id")
        key = parent if parent and parent in id_set else None
        by_parent.setdefault(key, []).append(t)

    result = []

    def walk(parent_id, prefix):
        for i, t in enumerate(by_parent.get(parent_id, [])):
            wbs = f"{prefix}.{i + 1}" if prefix else str(i + 1)
            depth = wbs.count(".")
            result.append({"task": t, "depth": depth, "wbs": wbs})
            walk(t["id"], wbs)

    walk(None, "")
    return result

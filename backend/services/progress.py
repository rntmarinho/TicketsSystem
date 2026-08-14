"""Porte de progress.ts (APPCNS) — percentual de conclusão, flat, sem peso por duração/profundidade."""


def compute_percent_complete(tasks):
    """tasks: lista de dicts com {"status": str}."""
    total = len(tasks)
    if total == 0:
        return 0
    done = sum(1 for t in tasks if t.get("status") == "FEITO")
    return round((done / total) * 100)

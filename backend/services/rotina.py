"""Porte de rotina.ts (APPCNS) — gera as datas de ocorrência de uma tarefa recorrente."""
from datetime import timedelta
from dateutil.relativedelta import relativedelta

MAX_OCCURRENCES = 366


def generate_rotina_occurrences(start_date, until_date, frequencia):
    """frequencia: 'DIARIA' | 'SEMANAL' | 'MENSAL'. Inclusive nas duas pontas,
    limitado a 366 ocorrências (evita gerar uma quantidade absurda de tarefas
    se alguém digitar uma data-limite muito distante por engano)."""
    if until_date < start_date:
        return []

    dates = []
    cursor = start_date
    while cursor <= until_date and len(dates) < MAX_OCCURRENCES:
        dates.append(cursor)
        if frequencia == "DIARIA":
            cursor = cursor + timedelta(days=1)
        elif frequencia == "SEMANAL":
            cursor = cursor + timedelta(days=7)
        else:
            cursor = cursor + relativedelta(months=1)
    return dates

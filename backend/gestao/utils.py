from datetime import datetime


def parse_datetime(value):
    """Converte string ISO 8601 (o formato que o frontend manda, com ou sem
    timezone) em datetime. None/'' passam direto — significam "sem data",
    não "erro de formato"."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = value.replace("Z", "+00:00") if isinstance(value, str) else value
    return datetime.fromisoformat(text)


def parse_datetime_fields(data, fields):
    """Aplica parse_datetime em cada chave de `fields` presente em `data`
    (in-place), pra passar de payload JSON cru pro que o service espera."""
    for f in fields:
        if f in data:
            data[f] = parse_datetime(data[f])
    return data

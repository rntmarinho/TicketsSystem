"""Porte de jitsi.ts (APPCNS) — gera uma sala do meet.jit.si público (sem
infraestrutura própria, mesma decisão já aprovada no plano de fusão)."""
import re
import secrets


def build_jitsi_url(slug):
    clean = re.sub(r"[^a-zA-Z0-9]", "", slug) or "sala"
    random_part = secrets.token_hex(4)
    return f"https://meet.jit.si/Consominas-{clean}-{random_part}"

"""
Porte de callMessage.ts (APPCNS) — uma chamada de vídeo é só uma mensagem de
chat cujo corpo começa com um prefixo reconhecível e contém o link do Jitsi.
Sem modelo de "sessão de chamada" separado — o histórico de chamadas e o
polling de "chamada chegando" leem a mesma tabela de mensagens.
"""
CALL_MESSAGE_PREFIX = "📹 Chamada iniciada"


def build_call_message(jitsi_url):
    return f"{CALL_MESSAGE_PREFIX}: {jitsi_url}"


def is_call_message(body):
    return bool(body) and body.startswith(CALL_MESSAGE_PREFIX)


def extract_call_url(body):
    if not is_call_message(body):
        return None
    parts = body.split(": ", 1)
    return parts[1].strip() if len(parts) == 2 else None

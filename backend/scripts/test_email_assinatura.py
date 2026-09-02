"""
Roda DENTRO do container de backend de teste: monta o e-mail de resposta de
chamado com e sem assinatura, interceptando o SMTP (nada é enviado), e confere
a estrutura MIME (multipart/related + imagem inline com Content-ID).
"""
import sys, email
from unittest import mock

sys.path.insert(0, "/app")
import services.email_service as es  # noqa: E402

captured = []


class FakeSMTP:
    def __init__(self, *a, **k): pass
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def starttls(self): pass
    def login(self, *a): pass
    def sendmail(self, frm, to, raw): captured.append((to, raw))


def run(autor_id, label):
    captured.clear()
    with mock.patch.object(es.smtplib, "SMTP", FakeSMTP), \
         mock.patch.object(es, "get_email_settings", return_value={"smtp_host": "x", "smtp_port": 1, "email_user": "suporte@x", "email_password": "y"}), \
         mock.patch.object(es.TicketModel, "set_email_message_id", lambda *a, **k: None):
        es.send_email_notification(
            ticket={"id": 999, "subject": "Teste", "user_id": int(sys.argv[1])},
            autor="Gestor", conteudo="corpo da resposta", autor_id=autor_id,
        )
    assert captured, f"{label}: nada enviado"
    to, raw = captured[0]
    msg = email.message_from_string(raw)
    parts = [p.get_content_type() for p in msg.walk()]
    return msg.get_content_type(), parts, raw


ct, parts, raw = run(int(sys.argv[2]), "com assinatura")
assert ct == "multipart/related", f"esperado multipart/related, veio {ct}"
assert "image/png" in parts and "text/html" in parts and "text/plain" in parts, parts
assert "cid:assinatura" in raw and "Content-ID: <assinatura>" in raw
print("COM assinatura OK:", ct, parts)

ct, parts, raw = run(int(sys.argv[3]), "sem assinatura (cliente)")
assert ct == "multipart/alternative", f"esperado multipart/alternative, veio {ct}"
assert "image/png" not in parts and "cid:assinatura" not in raw
print("SEM assinatura (autor CLIENTE, mesmo tendo assinatura no perfil) OK:", ct, parts)

ct, parts, raw = run(None, "sem autor_id (compatibilidade)")
assert ct == "multipart/alternative"
print("SEM autor_id (chamada antiga) OK:", ct)
print("EMAIL ASSEMBLY OK")

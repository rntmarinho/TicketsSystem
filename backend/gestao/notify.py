from gestao.models.notification_models import Notification, NOTIFICATION_TYPES


def notify(session, user_id, title, type="OUTRO", body=None, link=None):
    """Cria uma notificação (sem commit — quem chama decide). `type` fora do
    vocabulário conhecido cai em OUTRO em vez de estourar erro, pra nunca
    quebrar a ação principal por causa de uma notificação."""
    if type not in NOTIFICATION_TYPES:
        type = "OUTRO"
    session.add(Notification(user_id=user_id, type=type, title=title, body=body, link=link))

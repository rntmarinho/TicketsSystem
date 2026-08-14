import json
from gestao.models.audit_models import AuditLog


def record(session, user_id, action, entity_type=None, entity_id=None, metadata=None):
    """
    Grava uma entrada de auditoria na MESMA sessão/transação da ação que está
    sendo registrada (nenhum commit próprio aqui — quem chama decide quando
    commitar, igual reschedule_and_persist). Falha de auditoria não deve
    derrubar a ação principal: quem chama decide se quer capturar exceção
    (não fazemos isso aqui pra não mascarar erro de programação silenciosamente).
    """
    session.add(AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_json=json.dumps(metadata, default=str) if metadata else None,
    ))

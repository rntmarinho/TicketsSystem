from datetime import datetime, timezone, timedelta
from sqlalchemy import or_, and_
from gestao.models.message_models import TeamMessage, TeamMessageRead, DirectMessage
from gestao.models.team_models import UserTeam
from gestao.models.attachment_models import Attachment
from gestao.serializers import user_brief
from services.gestao_permissions import is_team_member
from services.call_message import is_call_message

MAX_BODY_LEN = 4000
INCOMING_CALL_WINDOW_SECONDS = 20


def _attachment_brief(session, column, message_id):
    """Anexo de chat vira uma mensagem própria (corpo '📎 nome') com um
    Attachment apontando pra ela — devolve o mínimo pro frontend montar o
    link de download (rota /gestao/attachments/<id>/download já existente)."""
    a = session.query(Attachment).filter(column == message_id).first()
    if not a:
        return None
    return {"id": a.id, "file_name": a.file_name, "file_size": a.file_size}


def _serialize_team_message(session, m):
    return {
        "id": m.id, "team_id": m.team_id, "body": m.body,
        "attachment": _attachment_brief(session, Attachment.team_message_id, m.id),
        "sender": user_brief(session, m.sender_id),
        "is_call": is_call_message(m.body),
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _serialize_direct_message(session, m):
    return {
        "id": m.id, "sender_id": m.sender_id, "receiver_id": m.receiver_id, "body": m.body,
        "attachment": _attachment_brief(session, Attachment.direct_message_id, m.id),
        "sender": user_brief(session, m.sender_id),
        "is_call": is_call_message(m.body),
        "read_at": m.read_at.isoformat() if m.read_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def list_team_messages(session, user_id, role, team_id):
    if not is_team_member(session, user_id, role, team_id):
        return {"success": False, "message": "Você não participa dessa equipe."}, 403
    messages = (
        session.query(TeamMessage)
        .filter(TeamMessage.team_id == team_id)
        .order_by(TeamMessage.created_at.asc())
        .limit(200)
        .all()
    )
    read = session.query(TeamMessageRead).filter(TeamMessageRead.user_id == user_id, TeamMessageRead.team_id == team_id).first()
    if read:
        read.last_read_at = datetime.now(timezone.utc)
    else:
        session.add(TeamMessageRead(user_id=user_id, team_id=team_id))
    session.commit()
    return [_serialize_team_message(session, m) for m in messages], 200


def create_team_message(session, user_id, role, team_id, body):
    if not is_team_member(session, user_id, role, team_id):
        return {"success": False, "message": "Você não participa dessa equipe."}, 403
    body = (body or "").strip()
    if not body or len(body) > MAX_BODY_LEN:
        return {"success": False, "message": f"Mensagem deve ter entre 1 e {MAX_BODY_LEN} caracteres."}, 422
    message = TeamMessage(team_id=team_id, sender_id=user_id, body=body)
    session.add(message)
    session.commit()
    return {"success": True, "message_obj": _serialize_team_message(session, message)}, 201


def list_direct_messages(session, user_id, other_user_id):
    messages = (
        session.query(DirectMessage)
        .filter(or_(
            and_(DirectMessage.sender_id == user_id, DirectMessage.receiver_id == other_user_id),
            and_(DirectMessage.sender_id == other_user_id, DirectMessage.receiver_id == user_id),
        ))
        .order_by(DirectMessage.created_at.asc())
        .limit(200)
        .all()
    )
    now = datetime.now(timezone.utc)
    for m in messages:
        if m.receiver_id == user_id and m.read_at is None:
            m.read_at = now
    session.commit()
    return [_serialize_direct_message(session, m) for m in messages], 200


def create_direct_message(session, user_id, receiver_id, body):
    body = (body or "").strip()
    if not body or len(body) > MAX_BODY_LEN:
        return {"success": False, "message": f"Mensagem deve ter entre 1 e {MAX_BODY_LEN} caracteres."}, 422
    if receiver_id == user_id:
        return {"success": False, "message": "Não é possível enviar mensagem pra si mesmo."}, 422
    message = DirectMessage(sender_id=user_id, receiver_id=receiver_id, body=body)
    session.add(message)
    session.commit()
    return {"success": True, "message_obj": _serialize_direct_message(session, message)}, 201


def unread_summary(session, user_id):
    direct_unread = (
        session.query(DirectMessage)
        .filter(DirectMessage.receiver_id == user_id, DirectMessage.read_at.is_(None))
        .count()
    )
    team_ids = [r[0] for r in session.query(UserTeam.team_id).filter(UserTeam.user_id == user_id).all()]
    per_team = {}
    for team_id in team_ids:
        read = session.query(TeamMessageRead).filter(TeamMessageRead.user_id == user_id, TeamMessageRead.team_id == team_id).first()
        since = read.last_read_at if read else datetime.min.replace(tzinfo=timezone.utc)
        count = session.query(TeamMessage).filter(TeamMessage.team_id == team_id, TeamMessage.created_at > since).count()
        if count:
            per_team[team_id] = count
    return {"direct_unread": direct_unread, "team_unread": per_team}


def call_history(session, user_id):
    direct = (
        session.query(DirectMessage)
        .filter(or_(DirectMessage.sender_id == user_id, DirectMessage.receiver_id == user_id))
        .filter(DirectMessage.body.like("📹%"))
        .order_by(DirectMessage.created_at.desc())
        .limit(50)
        .all()
    )
    team_ids = [r[0] for r in session.query(UserTeam.team_id).filter(UserTeam.user_id == user_id).all()]
    team = (
        session.query(TeamMessage)
        .filter(TeamMessage.team_id.in_(team_ids))
        .filter(TeamMessage.body.like("📹%"))
        .order_by(TeamMessage.created_at.desc())
        .limit(50)
        .all()
    ) if team_ids else []

    result = [{"scope": "direct", **_serialize_direct_message(session, m)} for m in direct]
    result += [{"scope": "team", **_serialize_team_message(session, m)} for m in team]
    result.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return result[:100]


def incoming_calls(session, user_id):
    """Chamadas (mensagens de chamada) dos últimos 20s destinadas a este
    usuário — pollado com frequência pelo frontend pra simular "toca agora"."""
    since = datetime.now(timezone.utc) - timedelta(seconds=INCOMING_CALL_WINDOW_SECONDS)
    direct = (
        session.query(DirectMessage)
        .filter(DirectMessage.receiver_id == user_id, DirectMessage.created_at > since)
        .filter(DirectMessage.body.like("📹%"))
        .all()
    )
    team_ids = [r[0] for r in session.query(UserTeam.team_id).filter(UserTeam.user_id == user_id).all()]
    team = (
        session.query(TeamMessage)
        .filter(TeamMessage.team_id.in_(team_ids), TeamMessage.created_at > since)
        .filter(TeamMessage.body.like("📹%"))
        .all()
    ) if team_ids else []

    result = [{"scope": "direct", **_serialize_direct_message(session, m)} for m in direct if m.sender_id != user_id]
    result += [{"scope": "team", **_serialize_team_message(session, m)} for m in team if m.sender_id != user_id]
    return result

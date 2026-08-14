from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, func
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

NOTIFICATION_TYPES = (
    "TAREFA_ATRIBUIDA", "PRAZO_ALTERADO", "TAREFA_ATRASADA", "APROVACAO_PENDENTE",
    "MENCAO_COMENTARIO", "REUNIAO_PROXIMA", "CONVITE_PROJETO", "OUTRO",
)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Enum(*NOTIFICATION_TYPES, name="notification_type", native_enum=False), nullable=False, default="OUTRO")
    title = Column(String(200), nullable=False)
    body = Column(String(500), nullable=True)
    link = Column(String(300), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

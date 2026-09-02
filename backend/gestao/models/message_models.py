from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint, func
from database.gestao_db import Base
from gestao.models.team_models import new_uuid


class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id = Column(String(36), primary_key=True, default=new_uuid)
    sender_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)


class TeamMessage(Base):
    __tablename__ = "team_messages"

    id = Column(String(36), primary_key=True, default=new_uuid)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class TeamMessageRead(Base):
    __tablename__ = "team_message_reads"
    __table_args__ = (UniqueConstraint("user_id", "team_id", name="uq_team_message_reads_pair"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    last_read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ProjectClient(Base):
    """Vínculo cliente<->projeto — define quem tem acesso ao Portal do Cliente
    a esse projeto especificamente. Blueprint do portal (backend/portal_cliente/)
    é estruturalmente separado das rotas internas de gestão, então uma rota
    nova nunca corre o risco de "esquecer" de filtrar por essa tabela."""
    __tablename__ = "project_clients"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_clients_pair"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)

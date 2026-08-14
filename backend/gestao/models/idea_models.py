from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum, func
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

IDEA_STATUSES = ("NOVA", "EM_ANALISE", "APROVADA", "REJEITADA", "CONVERTIDA")
IDEA_LEVELS = ("BAIXO", "MEDIO", "ALTO")


class Idea(Base):
    """Ideia/kaizen — backlog de melhoria por projeto, pode virar Task (convertida)."""
    __tablename__ = "ideas"

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)
    status = Column(Enum(*IDEA_STATUSES, name="idea_status", native_enum=False), nullable=False, default="NOVA", index=True)
    impact = Column(Enum(*IDEA_LEVELS, name="idea_level_impact", native_enum=False), nullable=False, default="MEDIO")
    viability = Column(Enum(*IDEA_LEVELS, name="idea_level_viability", native_enum=False), nullable=False, default="MEDIO")
    urgency = Column(Enum(*IDEA_LEVELS, name="idea_level_urgency", native_enum=False), nullable=False, default="MEDIO")
    created_by_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    converted_task_id = Column(String(36), ForeignKey("tasks.id"), nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class IdeaComment(Base):
    __tablename__ = "idea_comments"

    id = Column(String(36), primary_key=True, default=new_uuid)
    idea_id = Column(String(36), ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

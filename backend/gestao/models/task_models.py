from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey, Enum, Integer, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

TASK_STATUSES = ("A_FAZER", "FAZENDO", "BLOQUEADO", "FEITO")
TASK_PRIORITIES = ("BAIXA", "MEDIA", "ALTA", "URGENTE")
ROTINA_FREQUENCIAS = ("DIARIA", "SEMANAL", "MENSAL")
DEPENDENCY_TYPES = ("FS", "SS", "FF", "SF")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=new_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(*TASK_STATUSES, name="task_status", native_enum=False), nullable=False, default="A_FAZER", index=True)
    priority = Column(Enum(*TASK_PRIORITIES, name="task_priority", native_enum=False), nullable=False, default="MEDIA")
    start_date = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    duration_days = Column(Integer, nullable=True)
    is_entrega = Column(Boolean, nullable=False, default=False)
    is_rotina = Column(Boolean, nullable=False, default=False)
    rotina_frequencia = Column(Enum(*ROTINA_FREQUENCIAS, name="rotina_frequencia", native_enum=False), nullable=True)
    rotina_ate_data = Column(DateTime(timezone=True), nullable=True)
    rotina_group_id = Column(String(36), nullable=True, index=True)
    order = Column(Integer, nullable=False, default=0)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    assignee_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=True, index=True)
    parent_task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)
    locked = Column(Boolean, nullable=False, default=False)
    actual_started_at = Column(DateTime(timezone=True), nullable=True)
    actual_ended_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(Integer, ForeignKey("tbl_users.id"), nullable=True)
    # Marca a Task como originada da migração única de tbl_tickets (type='tarefa') —
    # ver backend/scripts/migrate_tarefa_tickets.py. Único e nulo pra qualquer outra
    # tarefa, garante que rodar o script de novo não duplique a migração.
    migrated_from_ticket_id = Column(Integer, nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    project = relationship("Project", back_populates="tasks")
    parent_task = relationship("Task", remote_side=[id], backref="subtasks")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan", order_by="TaskComment.created_at")
    custom_field_values = relationship("TaskCustomFieldValue", back_populates="task", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="task", cascade="all, delete-orphan")
    predecessor_links = relationship(
        "TaskDependency", foreign_keys="TaskDependency.successor_id", back_populates="successor", cascade="all, delete-orphan"
    )
    successor_links = relationship(
        "TaskDependency", foreign_keys="TaskDependency.predecessor_id", back_populates="predecessor", cascade="all, delete-orphan"
    )


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (UniqueConstraint("predecessor_id", "successor_id", name="uq_task_dependencies_pair"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    predecessor_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    successor_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Enum(*DEPENDENCY_TYPES, name="dependency_type", native_enum=False), nullable=False, default="FS")
    lag_days = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    predecessor = relationship("Task", foreign_keys=[predecessor_id], back_populates="successor_links")
    successor = relationship("Task", foreign_keys=[successor_id], back_populates="predecessor_links")


class TaskComment(Base):
    __tablename__ = "task_comments"

    id = Column(String(36), primary_key=True, default=new_uuid)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="comments")

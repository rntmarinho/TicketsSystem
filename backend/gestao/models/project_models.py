from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Enum, Integer, Float, func
)
from sqlalchemy.orm import relationship
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

PROJECT_STATUSES = ("PLANEJADO", "EM_ANDAMENTO", "PAUSADO", "CONCLUIDO")
APPROVAL_STATUSES = ("NAO_REQUER", "PENDENTE", "APROVADO", "REJEITADO")
HORIZONS = ("H1", "H2", "H3")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=new_uuid)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(*PROJECT_STATUSES, name="project_status", native_enum=False), nullable=False, default="PLANEJADO")
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    # Setor dono do projeto (02/09/2026) — base da visibilidade por setor, ver
    # services/gestao_permissions.py. Nulo = só TI/diretoria/gerência, dono,
    # aprovador e responsáveis por tarefa enxergam.
    department_id = Column(Integer, ForeignKey("tbl_departments.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False, index=True)
    approver_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=True)
    approval_status = Column(Enum(*APPROVAL_STATUSES, name="approval_status", native_enum=False), nullable=False, default="NAO_REQUER")
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    actual_started_at = Column(DateTime(timezone=True), nullable=True)
    actual_ended_at = Column(DateTime(timezone=True), nullable=True)
    kanban_columns = Column(Text, nullable=True)
    horizon = Column(Enum(*HORIZONS, name="horizon", native_enum=False), nullable=True)
    orcamento = Column(Float, nullable=True)
    # Marca o Project migrado de tbl_projects (Fase 1, migração única) — ver
    # backend/scripts/migrate_tarefa_tickets.py. Único e nulo pra qualquer
    # projeto criado direto no módulo novo.
    migrated_from_project_id = Column(Integer, nullable=True, unique=True)
    # Arquivado (03/09/2026): some da lista/Kanban geral (e as tarefas dele também),
    # mas continua acessível pelo link e pode ser desarquivado. Excluir é definitivo.
    archived_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    board = relationship("ProjectBoard", back_populates="project", uselist=False, cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project")
    custom_fields = relationship("CustomField", back_populates="project", cascade="all, delete-orphan")


class ProjectBoard(Base):
    """Quadro/anotações livres do projeto (aba de notas gerais) — 1:1 com Project."""
    __tablename__ = "project_boards"

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    content = Column(Text, nullable=False, default="")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    project = relationship("Project", back_populates="board")

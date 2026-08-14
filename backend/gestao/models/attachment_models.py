from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database.gestao_db import Base
from gestao.models.team_models import new_uuid


class Folder(Base):
    """
    Pasta de arquivos de projeto — organizador hierárquico, separado dos anexos
    de tarefa. `team_id` existe no schema desde já (reserva de campo pra Fase 3,
    pastas de equipe/chat) mas fica sempre nulo até lá; a Fase 1 só usa
    `project_id`. Dono é sempre exatamente um dos dois (garantido na camada de
    serviço, não por constraint de banco — mesma convenção do APPCNS original).
    """
    __tablename__ = "folders"

    id = Column(String(36), primary_key=True, default=new_uuid)
    name = Column(String(150), nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=True, index=True)
    parent_id = Column(String(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    parent = relationship("Folder", remote_side=[id], backref="children")
    attachments = relationship("Attachment", back_populates="folder")


class Attachment(Base):
    """
    Anexo polimórfico por FK de dono — Fase 1 só usa `task_id` e `project_id`
    (arquivos de tarefa e da aba "Arquivos" do projeto). `team_message_id`/
    `direct_message_id`/`team_id` chegam na Fase 3 (chat) — colunas reservadas
    aqui pra não precisar de outra migration só pra isso depois.
    """
    __tablename__ = "attachments"

    id = Column(String(36), primary_key=True, default=new_uuid)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=True, index=True)
    folder_id = Column(String(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True)
    team_message_id = Column(String(36), nullable=True, index=True)
    direct_message_id = Column(String(36), nullable=True, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="attachments")
    folder = relationship("Folder", back_populates="attachments")

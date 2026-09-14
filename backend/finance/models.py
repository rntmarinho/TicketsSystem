from sqlalchemy import Column, String, Text, Integer, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

# Módulo Financeiro (09/09/2026) — a "demanda" é especificamente uma
# solicitação de criação de ordem de compra: dados do fornecedor + itens da
# OC. Qualquer um abre, só vê a própria; setor Financeiro (ou ADMIN) vê e
# conclui todas.
DEMAND_STATUSES = ("ABERTA", "CONCLUIDA")

# Domínio oficial de SITAPR (situação de aprovação) do Senior ERP, tabela
# E420OCP — confirmado no workflow n8n "Consominas - Dossiê OC (TESTE
# SeniorX)" (não inventado). Usado pra decodificar o status sincronizado.
OC_SITUACAO_APROVACAO = {
    "ANA": "Em Análise",
    "PAS": "Repassado",
    "APR": "Aprovado",
    "REP": "Reprovado",
    "CAN": "Cancelado",
    "PRE": "Em Preparação",
    "AGA": "Aguardando Aprovação",
    "BLO": "Bloqueado",
}
# Situações que não mudam mais — parar de re-consultar o Senior pra essas.
OC_SITUACAO_FINAL = ("APR", "REP", "CAN")


class FinanceDemand(Base):
    __tablename__ = "finance_demands"

    id = Column(String(36), primary_key=True, default=new_uuid)
    status = Column(String(20), nullable=False, default="ABERTA")
    requester_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False, index=True)
    resolved_by_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    # Número da OC gerada no Senior (10/09/2026) — o Financeiro conclui a
    # demanda associando esse número, não só marcando "concluída" sem prova.
    numero_oc = Column(String(30), nullable=True)
    # Status da OC sincronizado do Senior (E420OCP.SITAPR), 1x/hora via n8n
    # (10/09/2026) — pra quem pediu acompanhar sem precisar perguntar pro
    # Financeiro. Fica null até a primeira sincronia encontrar a OC.
    oc_status_codigo = Column(String(3), nullable=True)
    oc_status_descricao = Column(String(30), nullable=True)
    oc_status_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Dados do fornecedor
    fornecedor_razao_social = Column(String(200), nullable=False)
    fornecedor_documento = Column(String(20), nullable=False)  # CNPJ ou CPF, só dígitos
    fornecedor_tipo_documento = Column(String(4), nullable=False)  # 'CNPJ' | 'CPF'
    fornecedor_cep = Column(String(9), nullable=False)
    fornecedor_endereco = Column(String(255), nullable=False)
    fornecedor_ie = Column(String(30), nullable=True)  # Inscrição Estadual — opcional ("se houver")

    # Dados da ordem de compra
    centro_custos = Column(String(120), nullable=False)
    observacao = Column(Text, nullable=False)

    items = relationship(
        "FinanceDemandItem", backref="demand", cascade="all, delete-orphan",
        order_by="FinanceDemandItem.order",
    )


class FinanceDemandItem(Base):
    __tablename__ = "finance_demand_items"

    id = Column(String(36), primary_key=True, default=new_uuid)
    demand_id = Column(String(36), ForeignKey("finance_demands.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(300), nullable=False)
    quantity = Column(Numeric(14, 4), nullable=False)
    unit_value = Column(Numeric(14, 2), nullable=False)
    order = Column(Integer, nullable=False, default=0)


class FinanceCentroCusto(Base):
    """Centros de custo do Senior (tabela E044CCU) que aceitam rateio
    (ACERAT='S') — sincronizado 1x/dia via n8n (GetDBInfo), não editável pela
    tela. `codigo` é o CODCCU do Senior, tratado como texto porque é assim
    que aparece em todo o resto do sistema (Suprimentos usa o mesmo padrão).
    Sem FK de finance_demands.centro_custos pra cá de propósito — a sincronia
    diária faz DELETE+INSERT completo, e uma FK travaria isso se algum centro
    usado por uma demanda antiga saísse da lista atual; a validação é feita
    na hora de criar a demanda, não pelo banco."""
    __tablename__ = "finance_centros_custo"

    codigo = Column(String(20), primary_key=True)
    descricao = Column(String(200), nullable=False)
    abreviacao = Column(String(60), nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

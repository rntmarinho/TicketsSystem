from sqlalchemy import (
    Column, String, Text, Integer, Numeric, Date, DateTime, ForeignKey, Enum, UniqueConstraint, func
)
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

# Status de acompanhamento interno da linha (não existe na planilha do ERP —
# é o motivo de o módulo existir). Cores/labels espelhados no frontend em
# src/constants/suprimentosStatus.js.
SUPRIMENTOS_STATUSES = ("PENDENTE", "EM_COTACAO", "APROVADO", "COMPRADO", "ATRASADO", "CANCELADO")

# Rótulos em pt-br usados só pro log automático de status_descricao (ver
# suprimentos_service.py::update_item) — espelha STATUS_OPTIONS do frontend.
SUPRIMENTOS_STATUS_LABELS = {
    "PENDENTE": "Pendente",
    "EM_COTACAO": "Em Cotação",
    "APROVADO": "Aprovado",
    "COMPRADO": "Comprado",
    "ATRASADO": "Atrasado",
    "CANCELADO": "Cancelado",
}

# Prazo padrão de compra quando a linha é importada pela primeira vez —
# decisão de negócio da Renata (24/08): toda solicitação nova entra com 72h
# de prazo, contadas a partir da importação (não sobrescreve prazo já
# preenchido numa reimportação, já que status_descricao/prazo/etc nunca são
# tocados pelo merge — ver import_spreadsheet).
PRAZO_PADRAO_HORAS = 72


class SuprimentosSolicitacao(Base):
    """
    Uma linha por item de solicitação de compra, importado da planilha de
    exportação do ERP Senior (relatório de Requisição/Solicitação de Compra).
    Cada linha pertence a um dono (owner_id — quem importou) e carrega, além
    das colunas originais da planilha, os 5 campos de acompanhamento que o
    ERP não tem: prazo, status, status_descricao, justificativa, comprador.

    Reimportação mescla por (owner_id, solicitacao, seq_solicitacao) — ver
    gestao/suprimentos/suprimentos_import.py::import_spreadsheet. A
    unicidade é por dono, não global: dois usuários de Suprimentos podem
    legitimamente importar a mesma solicitação em suas próprias planilhas.
    """
    __tablename__ = "suprimentos_solicitacoes"

    id = Column(String(36), primary_key=True, default=new_uuid)
    owner_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)

    # ── Colunas da planilha do ERP (nomes = slug do cabeçalho original) ──
    transacao = Column(String(50))
    produto = Column(String(50), index=True)
    derivacao = Column(String(50))
    familia = Column(String(50))
    um = Column(String(10))
    descricao_complementar_produto = Column(Text)
    centro_custo = Column(String(50))
    requisicao = Column(String(50), index=True)
    solicitacao = Column(String(50), index=True)
    cotacao = Column(String(50))
    situacao = Column(String(100))
    qtde_solicitada = Column(Numeric(14, 4))
    preco_sol = Column(Numeric(14, 4))
    qtde_aprovada = Column(Numeric(14, 4))
    qtde_cancelada = Column(Numeric(14, 4))
    previsao = Column(Date)
    periodo = Column(String(50))
    deposito = Column(String(50))
    filial_pedido = Column(String(50))
    data_solicitacao = Column(Date)
    pedido = Column(String(50))
    seq_pedido = Column(String(20))
    seq_requisicao = Column(String(20))
    filial_sol = Column(String(50))
    seq_solicitacao = Column(String(20))
    prioridade_compra = Column(String(50))
    interno = Column(String(10))  # coluna "Int." da planilha
    obs_solicitacao = Column(Text)
    procedencia = Column(String(100))
    usuario_aplicacao = Column(String(100))
    complemento = Column(Text)
    cta_financeira = Column(String(50))
    cta_contabil = Column(String(50))
    data_limite_compra = Column(Date)
    data_envio = Column(Date)
    processo_cotacao = Column(String(50))
    aprovacao_solicitante = Column(String(50))
    aprovada_pelo_solicitante = Column(String(10))
    cod_bem_principal = Column(String(50))
    cliente = Column(String(50))
    nome = Column(String(255))
    usuario_cancelamento = Column(String(100))
    data_cancelamento = Column(Date)
    hora_cancelamento = Column(String(20))
    nome_usuario_aplicacao = Column(String(255))
    descricao_centro_custo = Column(String(255))
    descricao_tipo_compra = Column(String(100))
    modalidade = Column(String(50))
    descricao_modalidade = Column(String(100))
    # "Usuário Comprador" do ERP — snapshot da exportação, distinto do
    # comprador_id abaixo (usuário do próprio sistema, editável pela tela).
    usuario_comprador = Column(String(100))
    nome_usuario_comprador = Column(String(255))
    seq_end_entrega = Column(String(20))
    endereco_entrega = Column(String(255))
    complemento_entrega = Column(String(255))
    cep_entrega = Column(String(20))
    bairro_entrega = Column(String(100))
    cidade_entrega = Column(String(100))
    estado_entrega = Column(String(5))
    nome_usuario_solicitante = Column(String(255))
    usuario_solicitante = Column(String(100))
    usuario_geracao = Column(String(100))
    nome_usuario_geracao = Column(String(255))

    # ── Campos novos de acompanhamento (não existem na planilha) ──
    prazo = Column(Date, nullable=True)
    status = Column(Enum(*SUPRIMENTOS_STATUSES, name="suprimentos_status", native_enum=False),
                     nullable=False, default="PENDENTE", index=True)
    # Log de histórico de status, incrementado automaticamente pelo sistema a
    # cada mudança de status (ver suprimentos_service.py::update_item) — não
    # é um campo de texto livre editável pelo usuário.
    status_descricao = Column(Text, nullable=True)
    justificativa = Column(Text, nullable=True)
    comprador_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=True, index=True)
    # Dados de transporte (código de embarcação, código de envio etc.) —
    # texto livre, sem estrutura fixa definida ainda.
    transporte = Column(Text, nullable=True)
    # Status da Ordem de Compra (não confundir com "status" acima, que é o
    # acompanhamento interno da solicitação) — texto livre, decisão da Renata
    # (25/08): sem lista fixa de opções por enquanto.
    status_pedido = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("owner_id", "solicitacao", "seq_solicitacao", name="uq_suprimentos_owner_solicitacao"),
    )


# Colunas da planilha (nome de exibição -> atributo do modelo), na ordem do
# cabeçalho real do arquivo exportado. Usado por suprimentos_import.py pra
# mapear célula -> coluna, e por suprimentos_service.py pra saber quais
# atributos são "importados" (nunca sobrescrevem os campos de acompanhamento
# acima numa reimportação).
PLANILHA_COLUNAS = {
    "Transação": "transacao",
    "Produto": "produto",
    "Derivação": "derivacao",
    "Família": "familia",
    "UM": "um",
    "Descrição Complementar do Produto": "descricao_complementar_produto",
    "Centro de Custo": "centro_custo",
    "Requisição": "requisicao",
    "Solicitação": "solicitacao",
    "Cotação": "cotacao",
    "Situação": "situacao",
    "Qtde Solicitada": "qtde_solicitada",
    "Preço Sol.": "preco_sol",
    "Qtde Aprovada": "qtde_aprovada",
    "Qtde Cancelada": "qtde_cancelada",
    "Previsão": "previsao",
    "Período": "periodo",
    "Depósito": "deposito",
    "Filial Pedido": "filial_pedido",
    "Data Solicitação": "data_solicitacao",
    "Pedido": "pedido",
    "Seq. Pedido": "seq_pedido",
    "Seq.Requisição": "seq_requisicao",
    "Filial Sol.": "filial_sol",
    "Seq. Solicitação": "seq_solicitacao",
    "Prioridade de compra": "prioridade_compra",
    "Int.": "interno",
    "Obs. Solicitação": "obs_solicitacao",
    "Procedência": "procedencia",
    "Usuário Aplicação": "usuario_aplicacao",
    "Complemento": "complemento",
    "Cta. Financeira": "cta_financeira",
    "Cta. Contábil": "cta_contabil",
    "Data Limite p/ Compra": "data_limite_compra",
    "Data Envio": "data_envio",
    "Processo Cotação": "processo_cotacao",
    "Aprovação Solicitante": "aprovacao_solicitante",
    "Aprovada pelo Solicitante": "aprovada_pelo_solicitante",
    "Cód. Bem Principal": "cod_bem_principal",
    "Cliente": "cliente",
    "Nome": "nome",
    "Usuário Cancelamento": "usuario_cancelamento",
    "Data Cancelamento": "data_cancelamento",
    "Hora Cancelamento": "hora_cancelamento",
    "Nome Usuário Aplicação": "nome_usuario_aplicacao",
    "Descrição Centro Custo": "descricao_centro_custo",
    "Descrição Tipo Compra": "descricao_tipo_compra",
    "Modalidade": "modalidade",
    "Descrição Modalidade": "descricao_modalidade",
    "Usuário Comprador": "usuario_comprador",
    "Nome Usu.Comprador": "nome_usuario_comprador",
    "Seq end entrega": "seq_end_entrega",
    "End. Ent.": "endereco_entrega",
    "Compl. Ent.": "complemento_entrega",
    "CEP ENT.": "cep_entrega",
    "Bairro Ent.": "bairro_entrega",
    "Cid. Ent.": "cidade_entrega",
    "Est. Ent.": "estado_entrega",
    "Nome Usuário Solicitante": "nome_usuario_solicitante",
    "Usuário Solicitante": "usuario_solicitante",
    "Usuário Geração": "usuario_geracao",
    "Nome Usu.Geração": "nome_usuario_geracao",
}

# Colunas numéricas (quantidade/preço) — convertidas com Decimal na importação.
PLANILHA_COLUNAS_NUMERICAS = {"qtde_solicitada", "preco_sol", "qtde_aprovada", "qtde_cancelada"}

# Colunas de data — convertidas via parse_excel_date na importação (número de
# série do Excel, "00/00/0000" literal, ou já um date/datetime resolvido pelo
# openpyxl, conforme a formatação original da célula).
PLANILHA_COLUNAS_DATA = {
    "previsao", "data_solicitacao", "data_limite_compra", "data_envio", "data_cancelamento",
}

# Colunas-âncora: se qualquer uma faltar no cabeçalho do arquivo enviado, a
# importação inteira é rejeitada (arquivo errado) antes de tocar qualquer linha.
PLANILHA_COLUNAS_ANCORA = ("Transação", "Solicitação", "Seq. Solicitação", "Produto")

# Campos que o usuário pode editar via PATCH, além dos importados acima —
# nunca id/owner_id/created_at/updated_at, nem as colunas de chave de negócio
# (solicitacao/seq_solicitacao só mudam via reimportação). status_descricao
# fica de fora de propósito — é escrito só pelo sistema (ver update_item).
CAMPOS_ACOMPANHAMENTO = ("prazo", "status", "justificativa", "comprador_id", "transporte", "status_pedido")

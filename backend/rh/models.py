from sqlalchemy import (
    Column, String, Text, Integer, Numeric, Date, DateTime, Boolean, ForeignKey, Enum, func
)
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

# Módulo RH (14/09/2026) — ATS interno, v1: só o fluxo de solicitação de vaga
# (solicitação -> aprovação pelo gerente do centro de custo -> fila do RH).
# Criar a vaga automaticamente no Senior X e publicar em sites de vagas ficou
# fora dessa v1 (barreiras reais fora do nosso controle: a Senior não tem uma
# especificação pública e estável da API de criação de vaga, e as plataformas
# de vagas exigem virar cliente pago ou aprovação formal de parceria — LinkedIn
# nem aceita novos parceiros na API completa). RH cria a vaga manualmente no
# Senior por enquanto, só marcando aqui quando foi feito.

VAGA_STATUSES = ("PENDENTE_APROVACAO", "APROVADA", "REPROVADA", "VAGA_CRIADA", "CANCELADA")
MOTIVO_ABERTURA = ("AUMENTO_QUADRO", "SUBSTITUICAO")
REGIME_CONTRATACAO = ("CLT", "PJ", "ESTAGIO", "TEMPORARIO", "OUTRO")


class RhAprovadorCentroCusto(Base):
    """Quem aprova solicitações de vaga de um centro de custo. Sincronizado
    automaticamente 1x/dia (+ sob demanda) via n8n a partir do webservice da
    Senior com.senior.g5.co.ger.cad.usuario (porta ListaGerente, devolve o
    e-mail do gerente por centro de custo -- achado real, 14/09/2026, depois
    de confirmar que E044CCU.CODUSU está zerado em 100% dos centros e não
    servia pra isso). Senior sempre vence no sync (decisão da Renata); o PUT
    manual (tela de admin) existe só pra ajuste temporário quando o gerente
    não tem e-mail cadastrado como usuário no TicketSystem, ou a Senior ainda
    não tem ninguém pra aquele centro. Chave é o código do centro de custo
    (FinanceCentroCusto.codigo), sem FK pelo mesmo motivo de
    finance_demands.centro_custos: a sincronização diária do Senior é
    DELETE+INSERT completo e uma FK quebraria isso."""
    __tablename__ = "rh_aprovadores_centro_custo"

    centro_custo = Column(String(20), primary_key=True)
    aprovador_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class VagaSolicitacao(Base):
    """Solicitação de abertura de vaga (formulário FOR 12.0.4 da Renata --
    parte 1, dados da vaga, e parte 2, checklist de provisionamento de TI pro
    primeiro dia). `aprovador_id` é resolvido automaticamente a partir de
    RhAprovadorCentroCusto no momento da criação, não escolhido por quem
    solicita. Só pode ser editada/cancelada pelo próprio solicitante enquanto
    PENDENTE_APROVACAO -- decidida (aprovada/reprovada), fica travada, é
    histórico de uma decisão já tomada por outra pessoa. `chamado_ti_id`
    (18/09/2026) é preenchido quando o RH marca como criada e algum item do
    checklist de TI foi marcado: abre um chamado normal (categoria "Suporte
    de TI") no próprio TicketSystem em vez de criar um fluxo paralelo."""
    __tablename__ = "rh_vagas_solicitacoes"

    id = Column(String(36), primary_key=True, default=new_uuid)
    status = Column(Enum(*VAGA_STATUSES, name="rh_vaga_status", native_enum=False),
                     nullable=False, default="PENDENTE_APROVACAO", index=True)
    requester_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
    aprovador_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False, index=True)
    decidido_por_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=True)
    decidido_em = Column(DateTime(timezone=True), nullable=True)
    comentario_decisao = Column(Text, nullable=True)
    criada_no_senior_em = Column(DateTime(timezone=True), nullable=True)
    referencia_vaga_senior = Column(String(60), nullable=True)
    chamado_ti_id = Column(Integer, ForeignKey("tbl_tickets.id"), nullable=True)
    publicada_externamente = Column(Boolean, nullable=False, default=False)

    # ── Campos do formulário (FOR 12.0.4, parte 1) ──
    motivo_abertura = Column(Enum(*MOTIVO_ABERTURA, name="rh_vaga_motivo", native_enum=False), nullable=False)
    motivo_substituicao = Column(String(255), nullable=True)
    colaborador_substituido = Column(String(255), nullable=True)
    cargo_existente_mec = Column(Boolean, nullable=False, default=False)
    cargo = Column(String(255), nullable=False)
    data_limite_inicio = Column(Date, nullable=True)
    responsavel_mobilizacao = Column(String(255), nullable=True)
    centro_custo = Column(String(20), nullable=False, index=True)
    numero_proposta_licitacao = Column(String(60), nullable=True)
    local_trabalho = Column(String(255), nullable=False)
    vaga_sigilosa = Column(Boolean, nullable=False, default=False)
    vaga_proposta_licitacao = Column(Boolean, nullable=False, default=False)
    quantidade_vagas = Column(Integer, nullable=False, default=1)
    candidato_deficiente = Column(String(20), nullable=True)
    sexo = Column(String(20), nullable=True)
    salario = Column(Numeric(12, 2), nullable=True)
    regime_contratacao = Column(Enum(*REGIME_CONTRATACAO, name="rh_vaga_regime", native_enum=False), nullable=False)
    regime_contratacao_outro = Column(String(120), nullable=True)
    jornada_trabalho = Column(String(255), nullable=True)
    atividades_principais = Column(Text, nullable=False)
    escolaridade_formacao = Column(Text, nullable=True)
    experiencias_habilidades = Column(Text, nullable=True)
    informacoes_adicionais = Column(Text, nullable=True)
    necessita_cnh = Column(Boolean, nullable=False, default=False)
    categoria_cnh = Column(String(20), nullable=True)
    beneficios = Column(Text, nullable=True)

    # ── Campos do formulário (FOR 12.0.4, parte 2 -- provisionamento de TI) ──
    # Tudo opcional: só usado se preenchido, vira o chamado de TI quando a
    # vaga é marcada como criada (ver rh/vaga_routes.py::marcar_criada).
    ti_mobiliario = Column(Boolean, nullable=False, default=False)
    ti_telefone_celular = Column(Boolean, nullable=False, default=False)
    ti_materiais_escritorio = Column(Boolean, nullable=False, default=False)
    ti_computador = Column(Boolean, nullable=False, default=False)
    ti_perfil_computador = Column(Text, nullable=True)
    ti_softwares = Column(Text, nullable=True)
    ti_outros_softwares = Column(Text, nullable=True)
    ti_acesso_pastas_rede = Column(Boolean, nullable=False, default=False)
    ti_caminho_pastas_rede = Column(Text, nullable=True)
    ti_acesso_vpn = Column(Boolean, nullable=False, default=False)
    ti_conta_email = Column(Boolean, nullable=False, default=False)
    ti_email_substituicao = Column(String(255), nullable=True)
    ti_criacao_assinatura_email = Column(Boolean, nullable=False, default=False)
    ti_acesso_intranet = Column(Boolean, nullable=False, default=False)
    ti_senha_telefone_fixo = Column(Boolean, nullable=False, default=False)
    ti_necessidade_art = Column(Boolean, nullable=False, default=False)
    ti_necessidade_epi = Column(Boolean, nullable=False, default=False)
    ti_necessidade_alojamento = Column(Boolean, nullable=False, default=False)
    ti_kit_roupa_cama_banho = Column(Boolean, nullable=False, default=False)
    ti_baixada = Column(Boolean, nullable=False, default=False)
    ti_periodicidade_baixada = Column(String(120), nullable=True)
    ti_deslocamento_mensal = Column(Boolean, nullable=False, default=False)
    ti_dias_deslocamento = Column(String(120), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


CANDIDATO_ETAPAS = ("TRIAGEM", "ENTREVISTA_RH", "ENTREVISTA_GESTOR", "PROPOSTA", "CONTRATADO", "REPROVADO")


class VagaCandidato(Base):
    """Bloco A do ATS (19/09/2026): pipeline de candidatos por vaga, só RH/ADMIN
    (não o aprovador/gestor). Cadastro manual -- currículo chega por e-mail/
    WhatsApp, RH lança aqui e move pelas etapas até contratar. Só pode ser
    criado com a vaga em APROVADA ou VAGA_CRIADA (ver candidato_routes.py);
    REPROVADO é etapa terminal, não status calculado."""
    __tablename__ = "rh_vaga_candidatos"

    id = Column(String(36), primary_key=True, default=new_uuid)
    vaga_id = Column(String(36), ForeignKey("rh_vagas_solicitacoes.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    telefone = Column(String(30), nullable=True)
    origem = Column(String(120), nullable=True)
    etapa = Column(Enum(*CANDIDATO_ETAPAS, name="rh_candidato_etapa", native_enum=False), nullable=False, default="TRIAGEM", index=True)
    motivo_reprovacao = Column(Text, nullable=True)
    order = Column(Integer, nullable=False, default=0)
    # Nulo (19/09/2026, Bloco B) = veio de inscrição pública, sem usuário do
    # sistema por trás (ver rh/public_routes.py) -- distingue de cadastro
    # manual pelo RH.
    created_by = Column(Integer, ForeignKey("tbl_users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class VagaCandidatoComentario(Base):
    """Histórico de interação com o candidato (notas de entrevista, feedback
    etc.) -- mesmo padrão de gestao.models.task_models.TaskComment."""
    __tablename__ = "rh_vaga_candidato_comentarios"

    id = Column(String(36), primary_key=True, default=new_uuid)
    candidato_id = Column(String(36), ForeignKey("rh_vaga_candidatos.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

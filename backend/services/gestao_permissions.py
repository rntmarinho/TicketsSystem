"""
Porte de permissions.ts (APPCNS). Desde a Fase 2, completo: ADMIN/DIRETOR e
nível hierárquico GERENCIA veem tudo; gerente de núcleo (NucleoGerente) vê
também as equipes que contêm gente dos núcleos que ele gerencia, além das
equipes das quais participa; os demais só veem as próprias equipes.
Simplificação mantida em relação ao APPCNS original: não modelamos
`Project.diretores`/`coordenadores` (M:N direto projeto-pessoa) nem
`Project.nucleos` (M:N direto projeto-núcleo) — não fazem parte do escopo
combinado pra Fase 2; a visibilidade por núcleo passa só pela equipe.
"""
from gestao.models.team_models import UserTeam
from gestao.models.nucleo_models import NucleoGerente, NucleoMembro
from gestao.models.legacy import LegacyUser

STAFF_ROLES = ("ADMIN", "DIRETOR", "GESTOR_PROJETO", "APROVADOR", "COLABORADOR", "VISUALIZADOR")


def can_access_gestao(role):
    """CLIENTE não tem acesso ao módulo de gestão ainda — chega na Fase 3 (Portal do Cliente),
    isolado em blueprint próprio. Hoje (Fase 1) CLIENTE já não tinha acesso a
    Projetos/Kanban/Gantt no TicketsSystem, então isso não é uma restrição nova."""
    return role in STAFF_ROLES


def get_user_team_ids(session, user_id):
    rows = session.query(UserTeam.team_id).filter(UserTeam.user_id == user_id).all()
    return [r[0] for r in rows]


def _nucleo_managed_user_ids(session, user_id):
    """IDs de pessoas que pertencem a núcleos gerenciados por este usuário (NucleoGerente)."""
    nucleo_ids = [r[0] for r in session.query(NucleoGerente.nucleo_id).filter(NucleoGerente.user_id == user_id).all()]
    if not nucleo_ids:
        return []
    rows = session.query(NucleoMembro.user_id).filter(NucleoMembro.nucleo_id.in_(nucleo_ids)).all()
    return [r[0] for r in rows]


def visible_project_team_ids(session, user_id, role):
    """Retorna None se o usuário vê todos os projetos (sem filtro necessário),
    ou a lista de team_ids visíveis pra ele (pode ser vazia)."""
    if role in ("ADMIN", "DIRETOR"):
        return None

    user = session.query(LegacyUser).get(user_id)
    if user and user.nivel_hierarquico == "GERENCIA":
        return None

    team_ids = set(get_user_team_ids(session, user_id))

    nucleo_user_ids = _nucleo_managed_user_ids(session, user_id)
    if nucleo_user_ids:
        extra_rows = session.query(UserTeam.team_id).filter(UserTeam.user_id.in_(nucleo_user_ids)).all()
        team_ids.update(r[0] for r in extra_rows)

    return list(team_ids)


def is_team_member(session, user_id, role, team_id):
    if role == "ADMIN":
        return True
    membership = (
        session.query(UserTeam)
        .filter(UserTeam.user_id == user_id, UserTeam.team_id == team_id)
        .first()
    )
    return membership is not None


def is_team_manager(session, user_id, team_id):
    membership = (
        session.query(UserTeam)
        .filter(UserTeam.user_id == user_id, UserTeam.team_id == team_id)
        .first()
    )
    return membership is not None and membership.role == "GESTOR"


def can_manage_team(session, user_id, role, team_id):
    if role == "ADMIN":
        return True
    return is_team_manager(session, user_id, team_id)


def can_manage_org_structure(role):
    """Criar/editar equipe nova ou núcleo — mudança de estrutura organizacional,
    não gestão do dia a dia de uma equipe já existente (essa é can_manage_team)."""
    return role in ("ADMIN", "DIRETOR")


def is_nucleo_manager(session, user_id, role, nucleo_id):
    if role in ("ADMIN", "DIRETOR"):
        return True
    return (
        session.query(NucleoGerente)
        .filter(NucleoGerente.user_id == user_id, NucleoGerente.nucleo_id == nucleo_id)
        .first()
        is not None
    )


def can_modify_task(role, is_assignee, locked):
    """Quem pode editar uma tarefa: Admin e Gestor de Projeto sempre (se não
    travada); Colaborador só se não travada e for responsável; demais nunca."""
    if locked:
        return role in ("ADMIN", "GESTOR_PROJETO")
    if role in ("ADMIN", "GESTOR_PROJETO"):
        return True
    if role == "COLABORADOR":
        return is_assignee
    return False


def can_delete_task(role):
    return role in ("ADMIN", "GESTOR_PROJETO")


def is_read_only_role(role):
    return role in ("CLIENTE", "VISUALIZADOR")


def can_view_project(session, user_id, role, project):
    """project: instância de gestao.models.project_models.Project (ou None)."""
    if project is None:
        return False
    if role in ("ADMIN", "DIRETOR"):
        return True
    team_ids = get_user_team_ids(session, user_id)
    return project.team_id in team_ids or project.owner_id == user_id or project.approver_id == user_id


def can_view_task(session, user_id, role, task):
    """
    Usado pela checagem de posse do anexo de tarefa (corrige o gap de IDOR que o
    APPCNS tinha — lá, "leitura aberta a qualquer autenticado" pra anexo de
    tarefa; aqui, precisa a mesma visibilidade da tarefa em si). Vê a tarefa
    quem vê o projeto dela, mais quem é o responsável direto (tarefa pessoal,
    sem visibilidade de equipe, ou responsável de fora da equipe do projeto).
    """
    if task is None:
        return False
    if role in ("ADMIN", "DIRETOR"):
        return True
    if task.assignee_id == user_id:
        return True
    if task.project_id is None:
        return False
    return can_view_project(session, user_id, role, task.project)

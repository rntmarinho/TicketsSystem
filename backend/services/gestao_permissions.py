"""
Porte de permissions.ts (APPCNS), reescrito em 02/09/2026 pra visibilidade de
projeto POR SETOR (decisão da Renata):

- Todo usuário ativo entra no módulo de gestão, inclusive CLIENTE — no
  TicketsSystem esse papel é o dos funcionários que abrem chamado pro TI
  (60 dos 69 usuários), não um cliente externo. CLIENTE se comporta como
  COLABORADOR dentro do módulo (edita tarefa de que é responsável).
- Projeto tem um setor (`projects.department_id` -> tbl_departments). Quem vê
  um projeto: gente do MESMO setor, o dono, o aprovador e quem é responsável
  por alguma tarefa dele. ADMIN, DIRETOR e nível hierárquico GERENCIA veem tudo.
- Equipe (Team/UserTeam) NÃO dá mais visibilidade de projeto — continua
  existindo pra chat, organização e o papel GESTOR dentro da equipe.
- Quem gerencia um projeto (editar, apagar, marcos/riscos, campos, pastas,
  clientes do portal): ADMIN, DIRETOR, GESTOR_PROJETO, o dono do projeto, ou
  GESTOR da equipe do projeto.
- Quem cria projeto: ADMIN/DIRETOR/GESTOR_PROJETO em qualquer setor; os demais
  só no próprio setor (ver project_service.create_project).

Simplificação mantida em relação ao APPCNS original: não modelamos
`Project.diretores`/`coordenadores`/`Project.nucleos` (M:N direto).
"""
from sqlalchemy import or_
from gestao.models.team_models import UserTeam
from gestao.models.nucleo_models import NucleoGerente, NucleoMembro
from gestao.models.legacy import LegacyUser

# Todos os 7 papéis entram no módulo de gestão. STAFF_ROLES é mantido como
# sinônimo por compatibilidade com as listagens de pessoas (responsável de
# tarefa, chat, presença, organograma) — que agora incluem CLIENTE de propósito.
GESTAO_ROLES = ("ADMIN", "DIRETOR", "GESTOR_PROJETO", "APROVADOR", "COLABORADOR", "VISUALIZADOR", "CLIENTE")
STAFF_ROLES = GESTAO_ROLES

# Veem qualquer projeto, de qualquer setor. VISUALIZADOR entra aqui de propósito:
# é o papel de oversight da diretoria/gerência (já enxerga todos os chamados em
# modo só-leitura) — restringir por setor seria regressão pra esses 4 usuários.
SEE_ALL_ROLES = ("ADMIN", "DIRETOR", "VISUALIZADOR")
# Níveis hierárquicos do cadastro (tbl_users.nivel_hierarquico) que também veem tudo.
SEE_ALL_LEVELS = ("DIRETORIA", "GERENCIA")
# Gerenciam qualquer projeto e criam em qualquer setor.
PROJECT_MANAGER_ROLES = ("ADMIN", "DIRETOR", "GESTOR_PROJETO")


def can_access_gestao(role):
    return role in GESTAO_ROLES


def get_user_team_ids(session, user_id):
    rows = session.query(UserTeam.team_id).filter(UserTeam.user_id == user_id).all()
    return [r[0] for r in rows]


def get_user_department_id(session, user_id):
    user = session.query(LegacyUser).get(user_id)
    return user.department_id if user else None


def _nucleo_managed_user_ids(session, user_id):
    """IDs de pessoas que pertencem a núcleos gerenciados por este usuário (NucleoGerente)."""
    nucleo_ids = [r[0] for r in session.query(NucleoGerente.nucleo_id).filter(NucleoGerente.user_id == user_id).all()]
    if not nucleo_ids:
        return []
    rows = session.query(NucleoMembro.user_id).filter(NucleoMembro.nucleo_id.in_(nucleo_ids)).all()
    return [r[0] for r in rows]


def sees_all_projects(session, user_id, role):
    """ADMIN, DIRETOR, VISUALIZADOR e quem tem nível hierárquico DIRETORIA/GERENCIA no cadastro."""
    if role in SEE_ALL_ROLES:
        return True
    user = session.query(LegacyUser).get(user_id)
    return bool(user and user.nivel_hierarquico in SEE_ALL_LEVELS)


def _project_visibility_filter(session, user_id, department_id):
    # Import local: project_models/task_models importam team_models, e este
    # módulo é importado por quase todo o pacote gestao — evita ciclo de import.
    from gestao.models.project_models import Project
    from gestao.models.task_models import Task

    assigned_project_ids = (
        session.query(Task.project_id)
        .filter(Task.assignee_id == user_id, Task.project_id.isnot(None))
    )
    conditions = [
        Project.owner_id == user_id,
        Project.approver_id == user_id,
        Project.id.in_(assigned_project_ids),
    ]
    if department_id is not None:
        conditions.append(Project.department_id == department_id)
    return or_(*conditions)


def visible_project_ids(session, user_id, role):
    """Retorna None se o usuário vê todos os projetos (sem filtro necessário),
    ou a lista de ids de projeto visíveis pra ele (pode ser vazia — ex.: usuário
    sem setor cadastrado que não é dono/aprovador/responsável de nada)."""
    if sees_all_projects(session, user_id, role):
        return None
    from gestao.models.project_models import Project

    department_id = get_user_department_id(session, user_id)
    rows = (
        session.query(Project.id)
        .filter(_project_visibility_filter(session, user_id, department_id))
        .all()
    )
    return [r[0] for r in rows]


def can_view_project(session, user_id, role, project):
    """project: instância de gestao.models.project_models.Project (ou None)."""
    if project is None:
        return False
    if sees_all_projects(session, user_id, role):
        return True
    if project.owner_id == user_id or project.approver_id == user_id:
        return True
    department_id = get_user_department_id(session, user_id)
    if department_id is not None and project.department_id == department_id:
        return True
    from gestao.models.task_models import Task

    return (
        session.query(Task.id)
        .filter(Task.project_id == project.id, Task.assignee_id == user_id)
        .first()
        is not None
    )


def can_manage_project(session, user_id, role, project):
    """Editar/apagar o projeto e tudo que é escopado por ele (campos, pastas,
    marcos, riscos, decisões, ideias, clientes do portal, cronograma)."""
    if project is None:
        return False
    if role in PROJECT_MANAGER_ROLES:
        return True
    if project.owner_id == user_id:
        return True
    return is_team_manager(session, user_id, project.team_id)


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
    """Gestão do dia a dia de uma EQUIPE (membros, metas/indicadores da equipe).
    Pra coisas escopadas por PROJETO, usar can_manage_project."""
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
    travada); Colaborador e Cliente (funcionário) só se não travada e forem o
    responsável; demais nunca."""
    if locked:
        return role in ("ADMIN", "GESTOR_PROJETO")
    if role in ("ADMIN", "GESTOR_PROJETO"):
        return True
    if role in ("COLABORADOR", "CLIENTE"):
        return is_assignee
    return False


def can_delete_task(role):
    return role in ("ADMIN", "GESTOR_PROJETO")


def is_read_only_role(role):
    """Só VISUALIZADOR é somente-leitura no módulo de gestão. CLIENTE deixou de
    ser (02/09/2026) — é funcionário e participa dos projetos do setor."""
    return role == "VISUALIZADOR"


def can_view_task(session, user_id, role, task):
    """
    Usado pela checagem de posse do anexo de tarefa (corrige o gap de IDOR que o
    APPCNS tinha — lá, "leitura aberta a qualquer autenticado" pra anexo de
    tarefa; aqui, precisa a mesma visibilidade da tarefa em si). Vê a tarefa
    quem vê o projeto dela, mais quem é o responsável direto (tarefa pessoal,
    sem projeto, ou responsável de fora do setor do projeto).
    """
    if task is None:
        return False
    if sees_all_projects(session, user_id, role):
        return True
    if task.assignee_id == user_id:
        return True
    if task.project_id is None:
        return task.created_by == user_id if hasattr(task, "created_by") else False
    return can_view_project(session, user_id, role, task.project)

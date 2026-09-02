# Modelos SQLAlchemy do módulo de Gestão de Projetos, um arquivo por domínio.
# Importar cada módulo de modelo aqui garante que Base.metadata os conheça
# antes do Alembic rodar (mesmo usando migrations escritas à mão, não
# autogenerate, isso mantém os modelos Python e o schema real sincronizados).
from database.gestao_db import Base  # noqa: F401
from gestao.models.legacy import LegacyUser  # noqa: F401
from gestao.models.team_models import Team, UserTeam  # noqa: F401
from gestao.models.project_models import Project, ProjectBoard  # noqa: F401
from gestao.models.task_models import Task, TaskDependency, TaskComment  # noqa: F401
from gestao.models.field_models import CustomField, TaskCustomFieldValue  # noqa: F401
from gestao.models.attachment_models import Attachment, Folder  # noqa: F401
from gestao.models.nucleo_models import Nucleo, NucleoMembro, NucleoGerente  # noqa: F401
from gestao.models.approval_models import ApprovalRequest  # noqa: F401
from gestao.models.goal_models import Goal, GoalAssignee  # noqa: F401
from gestao.models.project_extras_models import Milestone, Risk, Decision, ResourceRate  # noqa: F401
from gestao.models.idea_models import Idea, IdeaComment  # noqa: F401
from gestao.models.scorecard_models import ScorecardItem  # noqa: F401
from gestao.models.audit_models import AuditLog  # noqa: F401
from gestao.models.notification_models import Notification  # noqa: F401
from gestao.models.message_models import DirectMessage, TeamMessage, TeamMessageRead, ProjectClient  # noqa: F401

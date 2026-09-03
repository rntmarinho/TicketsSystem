import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, List, Kanban as KanbanIcon, GanttChartSquare, ClipboardList, Pencil, Archive, ArchiveRestore, Trash2, User, CalendarDays } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useAuth } from '../../context/AuthContext';
import { getProject, updateProject, deleteProject, createProject } from '../../services/gestao/projectService';
import ProjectFormModal from './components/ProjectFormModal';
import { getTasks, createTask, updateTask } from '../../services/gestao/taskService';
import { getStaff } from '../../services/gestao/teamService';
import { getDepartments } from '../../services/departmentService';
import { Building2 } from 'lucide-react';

const STATUS_LABELS = { PLANEJADO: 'Planejado', EM_ANDAMENTO: 'Em andamento', PAUSADO: 'Pausado', CONCLUIDO: 'Concluído' };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : null);
import TaskDrawer from './components/TaskDrawer';
import GestaoGanttView from './GestaoGanttView';
import ProjectExtras from './components/ProjectExtras';
import './styles/Gestao.css';

const COLUMNS = [
  { key: 'A_FAZER', label: 'A Fazer' },
  { key: 'FAZENDO', label: 'Fazendo' },
  { key: 'BLOQUEADO', label: 'Bloqueado' },
  { key: 'FEITO', label: 'Feito' },
];

const PRIORITY_CLASS = { BAIXA: 'gestao-priority-baixa', MEDIA: 'gestao-priority-media', ALTA: 'gestao-priority-alta', URGENTE: 'gestao-priority-urgente' };

const TaskCard = ({ task, onOpen }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`gestao-kanban-card${isDragging ? ' dragging' : ''}`}
      onClick={() => onOpen(task.id)}
    >
      <div className="gestao-kanban-card-title">{task.title}</div>
      <div className="gestao-kanban-card-meta">
        <span className={PRIORITY_CLASS[task.priority]}>{task.priority}</span>
        <span>{task.assignee?.name?.split(' ')[0] || '—'}</span>
      </div>
    </div>
  );
};

const KanbanColumn = ({ column, tasks, onOpen }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <div ref={setNodeRef} className="gestao-kanban-column" style={isOver ? { outline: '2px solid var(--accent)' } : undefined}>
      <div className="gestao-kanban-column-title">
        <span>{column.label}</span>
        <span>{tasks.length}</span>
      </div>
      {tasks.map((t) => <TaskCard key={t.id} task={t} onOpen={onOpen} />)}
    </div>
  );
};

const GestaoProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [view, setView] = useState('kanban');
  const [openTaskId, setOpenTaskId] = useState(null);
  const [newTitle, setNewTitle] = useState('');

  // Espelha services/gestao_permissions.py: só VISUALIZADOR é somente-leitura;
  // gerencia o projeto quem é ADMIN/DIRETOR/GESTOR_PROJETO ou o dono.
  const canCreateTask = role !== 'VISUALIZADOR';
  const isPrivileged = ['ADMIN', 'DIRETOR', 'GESTOR_PROJETO'].includes(role);
  const canManageExtras = isPrivileged || (project?.owner?.id != null && project.owner.id === user?.id);
  const canManage = canManageExtras;
  const isArchived = !!project?.archived_at;

  const handleArchive = async () => {
    const acao = isArchived ? 'desarquivar' : 'arquivar';
    if (!window.confirm(`Deseja ${acao} o projeto "${project.name}"?${isArchived ? '' : ' Ele some da lista e do Kanban geral, mas pode ser desarquivado depois.'}`)) return;
    const r = await updateProject(id, { archived: !isArchived });
    if (r.success === false) alert(r.message || `Não foi possível ${acao}.`);
    load();
  };

  const handleDelete = async () => {
    const n = tasks.length;
    if (!window.confirm(`Excluir o projeto "${project.name}"?\n\nIsso apaga o projeto${n ? ` e suas ${n} tarefa(s)` : ''}, com comentários, anexos, marcos, riscos, decisões e ideias. Não dá pra desfazer.\n\nSe a ideia é só tirar da lista, use "Arquivar".`)) return;
    const r = await deleteProject(id);
    if (r.success === false) { alert(r.message || 'Não foi possível excluir.'); return; }
    navigate('/gestao/projetos');
  };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (isPrivileged) getDepartments().then((d) => setDepartments(Array.isArray(d) ? d : []));
  }, [isPrivileged]);

  const load = useCallback(async () => {
    const [projectData, tasksData, staffData] = await Promise.all([
      getProject(id), getTasks({ projectId: id }), getStaff(),
    ]);
    setProject(projectData);
    setTasks(Array.isArray(tasksData) ? tasksData : []);
    setStaff(Array.isArray(staffData) ? staffData : []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;

    setTasks((prev) => prev.map((t) => (t.id === active.id ? { ...t, status: newStatus } : t)));
    const response = await updateTask(active.id, { status: newStatus });
    if (response.success === false) {
      alert(response.message || 'Não foi possível mover a tarefa.');
      load();
    }
  };

  const handleQuickCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const response = await createTask({ title: newTitle.trim(), project_id: id });
    if (response.success === false) {
      alert(response.message || 'Erro ao criar tarefa.');
      return;
    }
    setNewTitle('');
    load();
  };

  if (!project) return <div className="gestao-loading">Carregando...</div>;

  const topLevelTasks = tasks.filter((t) => !t.parent_task_id);

  return (
    <div className="gestao-container">
      <Link to="/gestao/projetos" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--text)' }}>
        <ArrowLeft size={16} /> Projetos
      </Link>
      {isArchived && (
        <div className="gestao-archived-banner">
          <Archive size={15} /> Projeto arquivado em {fmtDate(project.archived_at)} — não aparece na lista nem no Kanban geral.
          {canManage && <button type="button" className="gestao-btn-secondary" onClick={handleArchive}><ArchiveRestore size={14} /> Desarquivar</button>}
        </div>
      )}
      <header className="gestao-header gestao-project-header">
        <div className="gestao-project-title">
          <h1>{project.name}</h1>
          <div className="gestao-project-subtitle">
            {canManage ? (
              <select
                className={`gestao-select-inline gestao-status-select gestao-status-${project.status?.toLowerCase()}`}
                value={project.status}
                title="Status do projeto"
                onChange={async (e) => {
                  const r = await updateProject(id, { status: e.target.value });
                  if (r.success === false) alert(r.message || 'Erro ao mudar o status.');
                  load();
                }}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <span className={`gestao-badge gestao-status-${project.status?.toLowerCase()}`}>{STATUS_LABELS[project.status] || project.status}</span>
            )}
            <span className="gestao-project-setor" title="Setor do projeto — define quem enxerga">
              <Building2 size={14} />
              {isPrivileged ? (
                <select
                  className="gestao-select-inline"
                  value={project.department_id ?? ''}
                  onChange={async (e) => {
                    const department_id = e.target.value ? Number(e.target.value) : null;
                    const r = await updateProject(id, { department_id });
                    if (r.success === false) alert(r.message || 'Erro ao mudar o setor.');
                    load();
                  }}
                >
                  <option value="">Sem setor</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              ) : (
                <span>{project.department || 'Sem setor'}</span>
              )}
            </span>
            <span className="gestao-project-setor" title="Dono do projeto"><User size={14} /> {project.owner?.name || '—'}</span>
            {(project.start_date || project.end_date) && (
              <span className="gestao-project-setor" title="Período"><CalendarDays size={14} /> {fmtDate(project.start_date) || '…'} – {fmtDate(project.end_date) || '…'}</span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="gestao-project-actions">
            <button type="button" className="gestao-btn-secondary" onClick={() => setEditOpen(true)}><Pencil size={14} /> Editar</button>
            <button type="button" className="gestao-btn-secondary" onClick={handleArchive}>
              {isArchived ? <><ArchiveRestore size={14} /> Desarquivar</> : <><Archive size={14} /> Arquivar</>}
            </button>
            <button type="button" className="gestao-btn-secondary danger" onClick={handleDelete}><Trash2 size={14} /> Excluir</button>
          </div>
        )}
      </header>
      {project.description && <p style={{ opacity: 0.8, marginTop: -12 }}>{project.description}</p>}

      <div className="gestao-project-tabs">
        <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}><KanbanIcon size={15} /> Kanban</button>
        <button className={view === 'lista' ? 'active' : ''} onClick={() => setView('lista')}><List size={15} /> Lista</button>
        <button className={view === 'gantt' ? 'active' : ''} onClick={() => setView('gantt')}><GanttChartSquare size={15} /> Gantt</button>
        <button className={view === 'extras' ? 'active' : ''} onClick={() => setView('extras')}><ClipboardList size={15} /> Marcos/Riscos/Decisões/Ideias</button>
      </div>

      {canCreateTask && !isArchived && (
        <form onSubmit={handleQuickCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-h)' }}
            placeholder="Nova tarefa..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="gestao-btn-primary"><Plus size={16} /> Adicionar</button>
        </form>
      )}

      {view === 'kanban' && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="gestao-kanban">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key} column={col}
                tasks={topLevelTasks.filter((t) => t.status === col.key)}
                onOpen={setOpenTaskId}
              />
            ))}
          </div>
        </DndContext>
      )}

      {view === 'lista' && (
        <div className="gestao-task-list">
          {topLevelTasks.map((t) => (
            <div key={t.id} className="gestao-task-row" onClick={() => setOpenTaskId(t.id)}>
              <div className="gestao-task-row-title">{t.title}</div>
              <div>{t.assignee?.name || '—'}</div>
              <div className={PRIORITY_CLASS[t.priority]}>{t.priority}</div>
              <div>{t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '—'}</div>
              <div>{t.status === 'FEITO' ? '✓' : ''}</div>
            </div>
          ))}
          {topLevelTasks.length === 0 && <p className="gestao-empty">Nenhuma tarefa ainda.</p>}
        </div>
      )}

      {view === 'gantt' && <GestaoGanttView tasks={topLevelTasks} />}

      {view === 'extras' && <ProjectExtras projectId={id} canManage={canManageExtras} onTaskCreated={load} />}

      {editOpen && (
        <ProjectFormModal
          mode="edit" project={project} departments={departments} teams={[]} isPrivileged={isPrivileged}
          userDepartment={{ id: user?.department_id, name: user?.department }}
          onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); }}
          createProject={createProject} updateProject={updateProject}
        />
      )}

      {openTaskId && (
        <TaskDrawer
          taskId={openTaskId} staff={staff}
          onClose={() => setOpenTaskId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
};

export default GestaoProjectDetail;

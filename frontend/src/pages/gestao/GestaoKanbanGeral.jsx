import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Kanban as KanbanIcon, Loader2, FolderKanban } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTasks, updateTask } from '../../services/gestao/taskService';
import { getProjects } from '../../services/gestao/projectService';
import { getStaff } from '../../services/gestao/teamService';
import TaskDrawer from './components/TaskDrawer';
import './styles/Gestao.css';

/**
 * Kanban geral (menu Projetos > Kanban, 02/09/2026): todas as tarefas de
 * primeiro nível dos projetos que o usuário enxerga (regra por setor no
 * backend — GET /gestao/tasks/ já filtra) mais as tarefas de que ele é
 * responsável, em colunas por status, com filtro por projeto e responsável.
 * Mesmo arrastar-e-soltar da aba Kanban do projeto (PATCH status).
 */
const COLUMNS = [
  { key: 'A_FAZER', label: 'A Fazer' },
  { key: 'FAZENDO', label: 'Fazendo' },
  { key: 'BLOQUEADO', label: 'Bloqueado' },
  { key: 'FEITO', label: 'Feito' },
];
const PRIORITY_CLASS = { BAIXA: 'gestao-priority-baixa', MEDIA: 'gestao-priority-media', ALTA: 'gestao-priority-alta', URGENTE: 'gestao-priority-urgente' };

const TaskCard = ({ task, projectName, onOpen }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const overdue = task.due_date && task.status !== 'FEITO' && new Date(task.due_date) < new Date();
  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`gestao-kanban-card${isDragging ? ' dragging' : ''}`}
      onClick={() => onOpen(task.id)}
    >
      <div className="gestao-kanban-card-project">{projectName || 'Sem projeto'}</div>
      <div className="gestao-kanban-card-title">{task.title}</div>
      <div className="gestao-kanban-card-meta">
        <span className={PRIORITY_CLASS[task.priority]}>{task.priority}</span>
        <span>
          {task.assignee?.name?.split(' ')[0] || '—'}
          {task.due_date && (
            <span className={overdue ? 'gestao-overdue' : ''} style={{ marginLeft: 6 }}>
              {new Date(task.due_date).toLocaleDateString('pt-BR')}
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

const KanbanColumn = ({ column, tasks, projectNames, onOpen }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <div ref={setNodeRef} className="gestao-kanban-column" style={isOver ? { outline: '2px solid var(--accent)' } : undefined}>
      <div className="gestao-kanban-column-title">
        {column.label}
        <span className="gestao-kanban-count">{tasks.length}</span>
      </div>
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} projectName={projectNames[t.project_id]} onOpen={onOpen} />
      ))}
    </div>
  );
};

const GestaoKanbanGeral = () => {
  const { role, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [openTaskId, setOpenTaskId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    const [tasksData, projectsData, staffData] = await Promise.all([
      getTasks({ topLevel: true }), getProjects(), getStaff(),
    ]);
    setTasks(Array.isArray(tasksData) ? tasksData : []);
    setProjects(Array.isArray(projectsData) ? projectsData : []);
    setStaff(Array.isArray(staffData) ? staffData : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const projectNames = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects]);

  const visibleTasks = useMemo(() => tasks.filter((t) => {
    if (filterProject === '__none__' && t.project_id) return false;
    if (filterProject && filterProject !== '__none__' && t.project_id !== filterProject) return false;
    if (filterAssignee === '__me__' && t.assignee?.id !== user?.id) return false;
    if (filterAssignee && filterAssignee !== '__me__' && String(t.assignee?.id || '') !== filterAssignee) return false;
    return true;
  }), [tasks, filterProject, filterAssignee, user?.id]);

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

  const canCreateProject = role !== 'VISUALIZADOR' && (['ADMIN', 'DIRETOR', 'GESTOR_PROJETO'].includes(role) || !!user?.department_id);

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><KanbanIcon size={24} /> Kanban</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="gestao-select-inline" value={filterProject} onChange={(e) => setFilterProject(e.target.value)} title="Filtrar por projeto">
            <option value="">Todos os projetos</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__none__">Sem projeto</option>
          </select>
          <select className="gestao-select-inline" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} title="Filtrar por responsável">
            <option value="">Todos os responsáveis</option>
            <option value="__me__">Minhas tarefas</option>
            {staff.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </div>
      </header>

      {projects.length === 0 && (
        <p className="gestao-hint">
          O quadro mostra as tarefas dos projetos que você enxerga (do seu setor, ou em que é dono, aprovador ou responsável).
          Ainda não existe nenhum projeto visível pra você.
          {canCreateProject && <> <Link to="/gestao/projetos">Criar o primeiro projeto</Link>.</>}
        </p>
      )}

      {projects.length > 0 && tasks.length === 0 && (
        <p className="gestao-hint">
          Nenhuma tarefa nos seus projetos ainda. Abra um projeto em <Link to="/gestao/projetos"><FolderKanban size={13} /> Projetos</Link> e adicione tarefas — elas aparecem aqui.
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="gestao-kanban">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key} column={col}
              tasks={visibleTasks.filter((t) => t.status === col.key)}
              projectNames={projectNames}
              onOpen={setOpenTaskId}
            />
          ))}
        </div>
      </DndContext>

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

export default GestaoKanbanGeral;

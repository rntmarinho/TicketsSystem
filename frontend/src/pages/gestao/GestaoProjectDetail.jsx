import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, List, Kanban as KanbanIcon, GanttChartSquare } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useAuth } from '../../context/AuthContext';
import { getProject } from '../../services/gestao/projectService';
import { getTasks, createTask, updateTask } from '../../services/gestao/taskService';
import { getStaff } from '../../services/gestao/teamService';
import TaskDrawer from './components/TaskDrawer';
import GestaoGanttView from './GestaoGanttView';
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
  const { role } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [view, setView] = useState('kanban');
  const [openTaskId, setOpenTaskId] = useState(null);
  const [newTitle, setNewTitle] = useState('');

  const canCreateTask = !['CLIENTE', 'VISUALIZADOR'].includes(role);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
      <header className="gestao-header">
        <h1>{project.name}</h1>
      </header>
      {project.description && <p style={{ opacity: 0.8, marginTop: -12 }}>{project.description}</p>}

      <div className="gestao-project-tabs">
        <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}><KanbanIcon size={15} /> Kanban</button>
        <button className={view === 'lista' ? 'active' : ''} onClick={() => setView('lista')}><List size={15} /> Lista</button>
        <button className={view === 'gantt' ? 'active' : ''} onClick={() => setView('gantt')}><GanttChartSquare size={15} /> Gantt</button>
      </div>

      {canCreateTask && (
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

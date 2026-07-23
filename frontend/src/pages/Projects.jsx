import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Plus, Archive, RotateCcw, ListTodo, BarChart3, LayoutGrid } from 'lucide-react';
import { apiFetch } from '../services/api';
import { getProjects, createProject, setProjectStatus } from '../services/projectService';
import { getTickets, updateStatus, updateAssignee, updateTicket } from '../services/ticketService';
import { getPriorities } from '../services/priorityService';
import { STATUS_OPTIONS, normalizeStatus } from '../constants/ticketStatus';
import { useAuth } from '../context/AuthContext';
import './styles/Projects.css';

const emptyForm = { name: '', description: '', owner_id: '' };

const parseDate = (val) => {
  if (!val) return null;
  const clean = typeof val === 'string' ? val.replace(' GMT', '') : val;
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
};

const toDatetimeLocalValue = (value) => {
  const d = parseDate(value);
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmtDuracao = (horas) => {
  if (horas === null || horas === undefined) return '—';
  const total = Math.round(horas);
  const dias = Math.floor(total / 24);
  const resto = total % 24;
  return dias === 0 ? `${resto}h` : `${dias}d ${resto}h`;
};

const TABS = [
  { key: 'geral', label: 'Visão Geral', icon: LayoutGrid },
  { key: 'tarefas', label: 'Tarefas', icon: ListTodo },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3 },
];

const Projects = () => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const canEditTasks = role === 'admin' || role === 'technician';

  const [activeTab, setActiveTab] = useState('geral');

  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [taskProjectFilter, setTaskProjectFilter] = useState('');

  const loadData = async () => {
    try {
      const [projectData, ticketData, userData, priorityData] = await Promise.all([
        getProjects(),
        getTickets(),
        apiFetch('/users/').then(r => r.json()).catch(() => []),
        getPriorities().catch(() => [])
      ]);
      setProjects(Array.isArray(projectData) ? projectData : []);
      setTickets(Array.isArray(ticketData) ? ticketData : []);
      const users = Array.isArray(userData) ? userData : [];
      setStaff(users.filter(u => u.access_type === 'admin' || u.access_type === 'technician'));
      setPriorities(Array.isArray(priorityData) ? priorityData : []);
    } catch {
      // silencioso — página segue com listas vazias
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Contagem separada por tipo — chamado (suporte) e tarefa (gestão interna
  // do projeto) não se misturam numa única métrica, cada um com seu próprio
  // progresso/tempo médio.
  const counts = useMemo(() => {
    const vazio = () => ({ open: 0, closed: 0, somaDuracaoHoras: 0, qtdComDuracao: 0 });
    const map = {};
    tickets.forEach(t => {
      if (!t.project_id) return;
      const tipo = t.type === 'tarefa' ? 'tarefa' : 'chamado';
      if (!map[t.project_id]) map[t.project_id] = { chamado: vazio(), tarefa: vazio() };

      const bucket = map[t.project_id][tipo];
      if (t.status === 'closed') {
        bucket.closed += 1;

        const inicio = parseDate(t.creation);
        const fim = parseDate(t.close_time);
        if (inicio && fim) {
          bucket.somaDuracaoHoras += (fim - inicio) / (1000 * 60 * 60);
          bucket.qtdComDuracao += 1;
        }
      } else {
        bucket.open += 1;
      }
    });
    return map;
  }, [tickets]);

  // To-do list combinada de tarefas de todos os projetos (ou filtrada por um).
  const tarefas = useMemo(() => {
    return tickets
      .filter(t => t.type === 'tarefa')
      .filter(t => !taskProjectFilter || String(t.project_id) === taskProjectFilter)
      .map(t => ({ ...t, _prazo: parseDate(t.sla) }))
      .sort((a, b) => {
        if (!a._prazo && !b._prazo) return 0;
        if (!a._prazo) return 1;
        if (!b._prazo) return -1;
        return a._prazo - b._prazo;
      });
  }, [tickets, taskProjectFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const response = await createProject({
        name: formData.name,
        description: formData.description,
        owner_id: formData.owner_id ? Number(formData.owner_id) : null
      });
      if (response.success === false) {
        alert(response.message || 'Erro ao criar projeto.');
        return;
      }
      setFormData(emptyForm);
      setShowForm(false);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (project) => {
    const newStatus = project.status === 'active' ? 'archived' : 'active';
    await setProjectStatus(project.id, newStatus);
    loadData();
  };

  const handleTaskStatus = async (taskId, status) => {
    await updateStatus(taskId, status);
    loadData();
  };

  const handleTaskAssignee = async (taskId, value) => {
    await updateAssignee(taskId, value);
    loadData();
  };

  const handleTaskPriority = async (taskId, value) => {
    await updateTicket(taskId, { priority_id: value ? Number(value) : null });
    loadData();
  };

  const handleTaskDeadline = async (taskId, value) => {
    await updateTicket(taskId, { sla: value || null });
    loadData();
  };

  if (loading) return <div className="projects-loading">Carregando projetos...</div>;

  return (
    <div className="projects-container">
      <header className="projects-header">
        <div className="projects-title-block">
          <Briefcase size={24} />
          <h1>Projetos</h1>
        </div>
        {isAdmin && activeTab === 'geral' && (
          <button className="projects-btn-new" onClick={() => setShowForm(s => !s)}>
            <Plus size={18} /> Novo Projeto
          </button>
        )}
      </header>

      <nav className="projects-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`projects-tab ${activeTab === tab.key ? 'projects-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'geral' && (
        <>
          {isAdmin && showForm && (
            <form className="projects-form" onSubmit={handleCreate}>
              <input
                type="text"
                placeholder="Nome do projeto"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
              <select
                value={formData.owner_id}
                onChange={e => setFormData({ ...formData, owner_id: e.target.value })}
              >
                <option value="">Sem dono definido</option>
                {staff
                  .filter(u => u.situation !== 'I' || Number(u.id) === Number(formData.owner_id))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
              </select>
              <button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Criar'}
              </button>
            </form>
          )}

          <div className="projects-grid">
            {projects.length === 0 ? (
              <p className="projects-empty">Nenhum projeto cadastrado.</p>
            ) : (
              projects.map(project => (
                <div key={project.id} className={`project-card ${project.status === 'archived' ? 'project-card--archived' : ''}`}>
                  <div className="project-card-header">
                    <h3>{project.name}</h3>
                    {isAdmin && (
                      <button
                        className="project-archive-btn"
                        title={project.status === 'active' ? 'Arquivar' : 'Reativar'}
                        onClick={() => handleToggleStatus(project)}
                      >
                        {project.status === 'active' ? <Archive size={16} /> : <RotateCcw size={16} />}
                      </button>
                    )}
                  </div>

                  {project.description && <p className="project-description">{project.description}</p>}

                  <div className="project-meta">
                    <span>Dono: {project.owner_name || '—'}</span>
                    <span>{project.status === 'active' ? 'Ativo' : 'Arquivado'}</span>
                  </div>

                  {(() => {
                    const c = counts[project.id];
                    const chamado = c?.chamado || { open: 0, closed: 0, somaDuracaoHoras: 0, qtdComDuracao: 0 };
                    const tarefa = c?.tarefa || { open: 0, closed: 0, somaDuracaoHoras: 0, qtdComDuracao: 0 };

                    const bloco = (label, dados) => {
                      const total = dados.open + dados.closed;
                      const pct = total > 0 ? Math.round((dados.closed / total) * 100) : 0;
                      const media = dados.qtdComDuracao > 0 ? dados.somaDuracaoHoras / dados.qtdComDuracao : null;

                      return (
                        <div className="project-type-block">
                          <span className="project-type-label">{label}</span>

                          <div className="project-progress">
                            <div className="project-progress-track">
                              <div className="project-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="project-progress-label">{pct}% concluído</span>
                          </div>

                          <div className="project-counts">
                            <span className="project-count-open">{dados.open} em aberto</span>
                            <span className="project-count-closed">{dados.closed} fechados</span>
                          </div>

                          <div className="project-avg-time">
                            Tempo médio: <strong>{fmtDuracao(media)}</strong>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="project-type-breakdown">
                        {bloco('Chamados', chamado)}
                        {bloco('Tarefas', tarefa)}
                      </div>
                    );
                  })()}

                  <div className="project-links">
                    <Link to={`/kanban?project=${project.id}`} className="project-kanban-link">
                      Ver no Kanban
                    </Link>
                    <Link to={`/gantt?project=${project.id}`} className="project-gantt-link">
                      Ver no Gantt
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === 'tarefas' && (
        <div className="projects-tasks">
          <div className="projects-tasks-toolbar">
            <select value={taskProjectFilter} onChange={e => setTaskProjectFilter(e.target.value)}>
              <option value="">Todos os projetos</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {tarefas.length === 0 ? (
            <p className="projects-empty">Nenhuma tarefa encontrada.</p>
          ) : (
            <div className="tasks-table-wrapper">
              <table className="tasks-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>Tarefa</th>
                    <th>Tag</th>
                    <th>Progresso</th>
                    <th>Responsável</th>
                    <th>Prazo</th>
                    <th>Prioridade</th>
                  </tr>
                </thead>
                <tbody>
                  {tarefas.map(t => {
                    const vencida = t._prazo && t._prazo < new Date() && normalizeStatus(t.status) !== 'closed';
                    return (
                      <tr key={t.id}>
                        <td>{t.project || '—'}</td>
                        <td>
                          <Link to={`/tickets/${t.id}`} className="task-subject-link">
                            #{t.id} {t.subject}
                          </Link>
                        </td>
                        <td>
                          {t.category && <span className="task-tag">{t.category}</span>}
                        </td>
                        <td>
                          {canEditTasks ? (
                            <select
                              value={normalizeStatus(t.status)}
                              onChange={e => handleTaskStatus(t.id, e.target.value)}
                            >
                              {STATUS_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span>{STATUS_OPTIONS.find(o => o.value === normalizeStatus(t.status))?.label || t.status}</span>
                          )}
                        </td>
                        <td>
                          {canEditTasks ? (
                            <select
                              value={t.assigned_to || ''}
                              onChange={e => handleTaskAssignee(t.id, e.target.value)}
                            >
                              <option value="">Sem responsável</option>
                              {staff
                                .filter(u => u.situation !== 'I' || Number(u.id) === Number(t.assigned_to))
                                .map(u => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                          ) : (
                            <span>{t.assignee || 'Sem responsável'}</span>
                          )}
                        </td>
                        <td>
                          {canEditTasks ? (
                            <input
                              type="datetime-local"
                              className={vencida ? 'task-deadline--overdue' : ''}
                              value={toDatetimeLocalValue(t.sla)}
                              onChange={e => handleTaskDeadline(t.id, e.target.value)}
                            />
                          ) : (
                            <span className={vencida ? 'task-deadline--overdue' : ''}>
                              {t._prazo ? t._prazo.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          {canEditTasks ? (
                            <select
                              value={t.priority_id || ''}
                              onChange={e => handleTaskPriority(t.id, e.target.value)}
                            >
                              <option value="">—</option>
                              {priorities.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span>{t.priority || '—'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'relatorios' && (
        <div className="projects-reports">
          {projects.length === 0 ? (
            <p className="projects-empty">Nenhum projeto cadastrado.</p>
          ) : (
            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>Chamados abertos</th>
                    <th>Chamados fechados</th>
                    <th>Tempo médio (chamados)</th>
                    <th>Tarefas abertas</th>
                    <th>Tarefas fechadas</th>
                    <th>Tempo médio (tarefas)</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(project => {
                    const c = counts[project.id];
                    const chamado = c?.chamado || { open: 0, closed: 0, somaDuracaoHoras: 0, qtdComDuracao: 0 };
                    const tarefa = c?.tarefa || { open: 0, closed: 0, somaDuracaoHoras: 0, qtdComDuracao: 0 };
                    const mediaChamado = chamado.qtdComDuracao > 0 ? chamado.somaDuracaoHoras / chamado.qtdComDuracao : null;
                    const mediaTarefa = tarefa.qtdComDuracao > 0 ? tarefa.somaDuracaoHoras / tarefa.qtdComDuracao : null;

                    return (
                      <tr key={project.id}>
                        <td>{project.name}</td>
                        <td>{chamado.open}</td>
                        <td>{chamado.closed}</td>
                        <td>{fmtDuracao(mediaChamado)}</td>
                        <td>{tarefa.open}</td>
                        <td>{tarefa.closed}</td>
                        <td>{fmtDuracao(mediaTarefa)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Projects;

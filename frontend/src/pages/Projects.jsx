import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Plus, Archive, RotateCcw } from 'lucide-react';
import { apiFetch } from '../services/api';
import { getProjects, createProject, setProjectStatus } from '../services/projectService';
import { getTickets } from '../services/ticketService';
import { useAuth } from '../context/AuthContext';
import './styles/Projects.css';

const emptyForm = { name: '', description: '', owner_id: '' };

const parseDate = (val) => {
  if (!val) return null;
  const clean = typeof val === 'string' ? val.replace(' GMT', '') : val;
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDuracao = (horas) => {
  if (horas === null || horas === undefined) return '—';
  const total = Math.round(horas);
  const dias = Math.floor(total / 24);
  const resto = total % 24;
  return dias === 0 ? `${resto}h` : `${dias}d ${resto}h`;
};

const Projects = () => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [projectData, ticketData, userData] = await Promise.all([
        getProjects(),
        getTickets(),
        apiFetch('/users/').then(r => r.json())
      ]);
      setProjects(Array.isArray(projectData) ? projectData : []);
      setTickets(Array.isArray(ticketData) ? ticketData : []);
      const users = Array.isArray(userData) ? userData : [];
      setStaff(users.filter(u => u.access_type === 'admin' || u.access_type === 'technician'));
    } catch {
      // silencioso — página segue com listas vazias
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const counts = useMemo(() => {
    const map = {};
    tickets.forEach(t => {
      if (!t.project_id) return;
      if (!map[t.project_id]) map[t.project_id] = { open: 0, closed: 0, somaDuracaoHoras: 0, qtdComDuracao: 0 };
      if (t.status === 'closed') {
        map[t.project_id].closed += 1;

        const inicio = parseDate(t.creation);
        const fim = parseDate(t.close_time);
        if (inicio && fim) {
          map[t.project_id].somaDuracaoHoras += (fim - inicio) / (1000 * 60 * 60);
          map[t.project_id].qtdComDuracao += 1;
        }
      } else {
        map[t.project_id].open += 1;
      }
    });
    return map;
  }, [tickets]);

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

  if (loading) return <div className="projects-loading">Carregando projetos...</div>;

  return (
    <div className="projects-container">
      <header className="projects-header">
        <div className="projects-title-block">
          <Briefcase size={24} />
          <h1>Projetos</h1>
        </div>
        {isAdmin && (
          <button className="projects-btn-new" onClick={() => setShowForm(s => !s)}>
            <Plus size={18} /> Novo Projeto
          </button>
        )}
      </header>

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
            {staff.map(u => (
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
                const total = (c?.open || 0) + (c?.closed || 0);
                const pct = total > 0 ? Math.round((c.closed / total) * 100) : 0;
                const mediaHoras = c?.qtdComDuracao > 0 ? c.somaDuracaoHoras / c.qtdComDuracao : null;

                return (
                  <>
                    <div className="project-progress">
                      <div className="project-progress-track">
                        <div className="project-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="project-progress-label">{pct}% concluído</span>
                    </div>

                    <div className="project-counts">
                      <span className="project-count-open">{c?.open || 0} em aberto</span>
                      <span className="project-count-closed">{c?.closed || 0} fechados</span>
                    </div>

                    <div className="project-avg-time">
                      Tempo médio de resolução: <strong>{fmtDuracao(mediaHoras)}</strong>
                    </div>
                  </>
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
    </div>
  );
};

export default Projects;

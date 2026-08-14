import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getProjects, createProject } from '../../services/gestao/projectService';
import { getTeams } from '../../services/gestao/teamService';
import './styles/Gestao.css';

const STATUS_LABELS = {
  PLANEJADO: 'Planejado',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluído',
};

const GestaoProjects = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', team_id: '' });
  const [saving, setSaving] = useState(false);

  const canCreate = ['ADMIN', 'DIRETOR', 'GESTOR_PROJETO'].includes(role);

  const load = async () => {
    setLoading(true);
    const [projectsData, teamsData] = await Promise.all([getProjects(), getTeams()]);
    setProjects(Array.isArray(projectsData) ? projectsData : []);
    setTeams(Array.isArray(teamsData) ? teamsData : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const response = await createProject({
      name: form.name,
      description: form.description,
      team_id: form.team_id || undefined,
    });
    setSaving(false);
    if (response.success === false) {
      alert(response.message || 'Erro ao criar projeto.');
      return;
    }
    setShowModal(false);
    setForm({ name: '', description: '', team_id: '' });
    load();
  };

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><FolderKanban size={24} /> Projetos</h1>
        {canCreate && (
          <button className="gestao-btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Novo Projeto
          </button>
        )}
      </header>

      <div className="gestao-project-grid">
        {projects.length === 0 && (
          <p className="gestao-empty">Nenhum projeto ainda.</p>
        )}
        {projects.map((p) => (
          <div key={p.id} className="gestao-project-card" onClick={() => navigate(`/gestao/projetos/${p.id}`)}>
            <div className="gestao-project-card-header">
              <h3>{p.name}</h3>
              <span className={`gestao-badge gestao-status-${p.status?.toLowerCase()}`}>
                {STATUS_LABELS[p.status] || p.status}
              </span>
            </div>
            {p.description && <p className="gestao-project-desc">{p.description}</p>}
            <div className="gestao-progress-bar">
              <div className="gestao-progress-fill" style={{ width: `${p.percent_complete || 0}%` }} />
            </div>
            <div className="gestao-project-meta">
              <span>{p.percent_complete || 0}% concluído</span>
              {p.overdue_count > 0 && <span className="gestao-overdue">{p.overdue_count} atrasada(s)</span>}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="gestao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="gestao-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Novo Projeto</h2>
            <form onSubmit={handleCreate}>
              <label>Nome</label>
              <input
                type="text" required minLength={2} maxLength={150}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <label>Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              {teams.length > 1 && (
                <>
                  <label>Equipe</label>
                  <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                    <option value="">(padrão)</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </>
              )}
              <div className="gestao-modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="gestao-btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoProjects;

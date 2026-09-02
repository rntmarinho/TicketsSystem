import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, Loader2, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getProjects, createProject } from '../../services/gestao/projectService';
import { getTeams } from '../../services/gestao/teamService';
import { getDepartments } from '../../services/departmentService';
import './styles/Gestao.css';

const STATUS_LABELS = {
  PLANEJADO: 'Planejado',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluído',
};

// Espelha services/gestao_permissions.py::PROJECT_MANAGER_ROLES — criam projeto
// em qualquer setor. Os demais criam só no próprio setor (o backend força isso
// de qualquer forma; aqui só refletimos na tela).
const PRIVILEGED_ROLES = ['ADMIN', 'DIRETOR', 'GESTOR_PROJETO'];

const GestaoProjects = () => {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterDept, setFilterDept] = useState('');
  const [form, setForm] = useState({ name: '', description: '', team_id: '', department_id: '' });
  const [saving, setSaving] = useState(false);

  const isPrivileged = PRIVILEGED_ROLES.includes(role);
  const myDepartmentId = user?.department_id || null;
  // VISUALIZADOR é somente-leitura; quem não é privilegiado precisa ter setor
  // cadastrado pra criar (o projeto nasce no setor da pessoa).
  const canCreate = role !== 'VISUALIZADOR' && (isPrivileged || !!myDepartmentId);

  const load = async () => {
    setLoading(true);
    const [projectsData, teamsData, deptData] = await Promise.all([getProjects(), getTeams(), getDepartments()]);
    setProjects(Array.isArray(projectsData) ? projectsData : []);
    setTeams(Array.isArray(teamsData) ? teamsData : []);
    setDepartments(Array.isArray(deptData) ? deptData : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openModal = () => {
    setForm({ name: '', description: '', team_id: '', department_id: myDepartmentId ? String(myDepartmentId) : '' });
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const response = await createProject({
      name: form.name,
      description: form.description,
      team_id: form.team_id || undefined,
      department_id: form.department_id ? Number(form.department_id) : null,
    });
    setSaving(false);
    if (response.success === false) {
      alert(response.message || 'Erro ao criar projeto.');
      return;
    }
    setShowModal(false);
    load();
  };

  const visibleProjects = useMemo(() => {
    if (!filterDept) return projects;
    if (filterDept === '__none__') return projects.filter((p) => !p.department_id);
    return projects.filter((p) => String(p.department_id) === filterDept);
  }, [projects, filterDept]);

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><FolderKanban size={24} /> Projetos</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {isPrivileged && departments.length > 0 && (
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="gestao-select-inline" title="Filtrar por setor">
              <option value="">Todos os setores</option>
              {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              <option value="__none__">Sem setor</option>
            </select>
          )}
          {canCreate && (
            <button className="gestao-btn-primary" onClick={openModal}>
              <Plus size={18} /> Novo Projeto
            </button>
          )}
        </div>
      </header>

      {!isPrivileged && !myDepartmentId && (
        <p className="gestao-hint">
          Seu usuário não tem setor cadastrado — você só enxerga projetos em que é dono, aprovador ou responsável por
          alguma tarefa. Peça ao TI pra cadastrar seu setor na tela Usuários.
        </p>
      )}

      <div className="gestao-project-grid">
        {visibleProjects.length === 0 && (
          <p className="gestao-empty">Nenhum projeto ainda.</p>
        )}
        {visibleProjects.map((p) => (
          <div key={p.id} className="gestao-project-card" onClick={() => navigate(`/gestao/projetos/${p.id}`)}>
            <div className="gestao-project-card-header">
              <h3>{p.name}</h3>
              <span className={`gestao-badge gestao-status-${p.status?.toLowerCase()}`}>
                {STATUS_LABELS[p.status] || p.status}
              </span>
            </div>
            <div className="gestao-project-setor">
              <Building2 size={13} /> {p.department || 'Sem setor'}
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
              <label>Setor</label>
              {isPrivileged ? (
                <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                  <option value="">Sem setor (só TI/diretoria enxerga)</option>
                  {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
              ) : (
                <input type="text" value={user?.department || ''} disabled />
              )}
              <small className="gestao-hint">Quem é do setor escolhido enxerga o projeto; dono, aprovador e responsáveis por tarefa também.</small>
              {isPrivileged && teams.length > 1 && (
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

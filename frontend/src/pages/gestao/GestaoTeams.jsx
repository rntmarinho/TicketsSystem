import { useState, useEffect } from 'react';
import { Plus, Users, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTeams, getTeamMembers, createTeam, addTeamMember, removeTeamMember } from '../../services/gestao/teamService';
import { getStaff } from '../../services/gestao/teamService';
import './styles/Gestao.css';

const GestaoTeams = () => {
  const { role } = useAuth();
  const [teams, setTeams] = useState([]);
  const [staff, setStaff] = useState([]);
  const [membersByTeam, setMembersByTeam] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [pickUser, setPickUser] = useState('');

  const canManageOrg = ['ADMIN', 'DIRETOR'].includes(role);

  const load = async () => {
    setLoading(true);
    const [teamsData, staffData] = await Promise.all([getTeams(), getStaff()]);
    const list = Array.isArray(teamsData) ? teamsData : [];
    setTeams(list);
    setStaff(Array.isArray(staffData) ? staffData : []);
    const membersEntries = await Promise.all(list.map(async (t) => [t.id, await getTeamMembers(t.id)]));
    setMembersByTeam(Object.fromEntries(membersEntries));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const response = await createTeam(form);
    setSaving(false);
    if (response.success === false) {
      alert(response.message || 'Erro ao criar equipe.');
      return;
    }
    setShowModal(false);
    setForm({ name: '', description: '' });
    load();
  };

  const handleAddMember = async (teamId) => {
    if (!pickUser) return;
    const response = await addTeamMember(teamId, Number(pickUser));
    if (response.success === false) {
      alert(response.message || 'Erro ao adicionar membro.');
      return;
    }
    setPickUser('');
    setAddingTo(null);
    load();
  };

  const handleRemoveMember = async (teamId, userId) => {
    if (!window.confirm('Remover este membro da equipe?')) return;
    await removeTeamMember(teamId, userId);
    load();
  };

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><Users size={24} /> Equipes</h1>
        {canManageOrg && (
          <button className="gestao-btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Nova Equipe
          </button>
        )}
      </header>

      <div className="gestao-team-list">
        {teams.map((t) => (
          <div key={t.id} className="gestao-team-card">
            <div className="gestao-team-card-header">
              <h3>{t.name}</h3>
              <button className="gestao-btn-secondary" onClick={() => setAddingTo(addingTo === t.id ? null : t.id)}>
                <Plus size={14} /> Membro
              </button>
            </div>
            {t.description && <p className="gestao-project-desc">{t.description}</p>}

            {addingTo === t.id && (
              <div className="gestao-inline-form">
                <select value={pickUser} onChange={(e) => setPickUser(e.target.value)}>
                  <option value="">Selecione...</option>
                  {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button className="gestao-btn-primary" onClick={() => handleAddMember(t.id)}>Adicionar</button>
              </div>
            )}

            <ul className="gestao-member-list">
              {(membersByTeam[t.id] || []).map((m) => (
                <li key={m.id}>
                  <span>{m.name}</span>
                  <span className="gestao-badge">{m.team_role === 'GESTOR' ? 'Gestor' : 'Membro'}</span>
                  <button className="gestao-icon-btn" onClick={() => handleRemoveMember(t.id, m.id)} title="Remover">
                    <X size={14} />
                  </button>
                </li>
              ))}
              {(membersByTeam[t.id] || []).length === 0 && <li className="gestao-empty">Sem membros ainda.</li>}
            </ul>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="gestao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="gestao-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nova Equipe</h2>
            <form onSubmit={handleCreate}>
              <label>Nome</label>
              <input type="text" required minLength={2} maxLength={150}
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label>Descrição</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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

export default GestaoTeams;

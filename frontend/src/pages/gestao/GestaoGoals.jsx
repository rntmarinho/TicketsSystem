import { useState, useEffect } from 'react';
import { Plus, Target, Loader2, Trash2 } from 'lucide-react';
import { getGoals, createGoal, updateGoal, deleteGoal } from '../../services/gestao/goalService';
import './styles/Gestao.css';

const GestaoGoals = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', target_value: '', unit: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await getGoals();
    setGoals(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const response = await createGoal({
      ...form,
      target_value: form.target_value ? Number(form.target_value) : null,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    });
    setSaving(false);
    if (response.success === false) {
      alert(response.message || 'Erro ao criar meta.');
      return;
    }
    setShowModal(false);
    setForm({ title: '', description: '', target_value: '', unit: '', due_date: '' });
    load();
  };

  const handleProgress = async (goal, value) => {
    await updateGoal(goal.id, { current_value: Number(value) });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta meta?')) return;
    await deleteGoal(id);
    load();
  };

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><Target size={24} /> Metas</h1>
        <button className="gestao-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nova Meta
        </button>
      </header>

      {goals.length === 0 && <p className="gestao-empty">Nenhuma meta cadastrada ainda.</p>}
      <div className="gestao-project-grid">
        {goals.map((g) => {
          const pct = g.target_value ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
          return (
            <div key={g.id} className="gestao-project-card">
              <div className="gestao-project-card-header">
                <h3>{g.title}</h3>
                <button className="gestao-icon-btn" onClick={() => handleDelete(g.id)}><Trash2 size={14} /></button>
              </div>
              {g.description && <p className="gestao-project-desc">{g.description}</p>}
              {g.target_value != null && (
                <>
                  <div className="gestao-progress-bar">
                    <div className="gestao-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="gestao-project-meta">
                    <span>{g.current_value} / {g.target_value} {g.unit}</span>
                    <input
                      type="number" className="gestao-inline-number" defaultValue={g.current_value}
                      onBlur={(e) => e.target.value !== String(g.current_value) && handleProgress(g, e.target.value)}
                    />
                  </div>
                </>
              )}
              {g.due_date && <span className="gestao-org-cargo">Prazo: {new Date(g.due_date).toLocaleDateString('pt-BR')}</span>}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="gestao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="gestao-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nova Meta</h2>
            <form onSubmit={handleCreate}>
              <label>Título</label>
              <input type="text" required minLength={2} maxLength={200}
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <label>Descrição</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <label>Valor alvo</label>
              <input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} />
              <label>Unidade</label>
              <input type="text" placeholder="ex: %, R$, chamados" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <label>Prazo</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
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

export default GestaoGoals;

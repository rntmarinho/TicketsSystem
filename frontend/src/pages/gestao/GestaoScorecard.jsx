import { useState, useEffect } from 'react';
import { Plus, Gauge, Loader2, Trash2 } from 'lucide-react';
import { getScorecardItems, createScorecardItem, updateScorecardItem, deleteScorecardItem } from '../../services/gestao/scorecardService';
import './styles/Gestao.css';

const SCOPE_LABELS = { PESSOAL: 'Pessoal', EQUIPE: 'Equipe', PROJETO: 'Projeto', CORPORATIVO: 'Corporativo' };
const COLOR_LABELS = { VERDE: '🟢', AMARELO: '🟡', VERMELHO: '🔴' };

const GestaoScorecard = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ scope: 'PESSOAL', objective: '', indicator: '', target: '', unit: '', status_color: 'VERDE' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await getScorecardItems();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const response = await createScorecardItem({ ...form, target: form.target ? Number(form.target) : null });
    setSaving(false);
    if (response.success === false) {
      alert(response.message || 'Erro ao criar indicador.');
      return;
    }
    setShowModal(false);
    setForm({ scope: 'PESSOAL', objective: '', indicator: '', target: '', unit: '', status_color: 'VERDE' });
    load();
  };

  const handleUpdateCurrent = async (item, value) => {
    await updateScorecardItem(item.id, { current: Number(value) });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este indicador?')) return;
    await deleteScorecardItem(id);
    load();
  };

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><Gauge size={24} /> Indicadores (Scorecard)</h1>
        <button className="gestao-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Novo Indicador
        </button>
      </header>

      {items.length === 0 && <p className="gestao-empty">Nenhum indicador cadastrado ainda.</p>}
      <div className="gestao-table-wrap">
        <table className="gestao-table">
          <thead>
            <tr><th>Escopo</th><th>Objetivo</th><th>Indicador</th><th>Atual</th><th>Alvo</th><th></th><th></th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td><span className="gestao-badge">{SCOPE_LABELS[i.scope]}</span></td>
                <td>{i.objective}</td>
                <td>{i.indicator}</td>
                <td>
                  <input type="number" className="gestao-inline-number" defaultValue={i.current}
                    onBlur={(e) => e.target.value !== String(i.current) && handleUpdateCurrent(i, e.target.value)} />
                  {i.unit}
                </td>
                <td>{i.target != null ? `${i.target} ${i.unit || ''}` : '—'}</td>
                <td>{COLOR_LABELS[i.status_color]}</td>
                <td><button className="gestao-icon-btn" onClick={() => handleDelete(i.id)}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="gestao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="gestao-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Novo Indicador</h2>
            <form onSubmit={handleCreate}>
              <label>Escopo</label>
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label>Objetivo</label>
              <input type="text" required value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
              <label>Indicador</label>
              <input type="text" required value={form.indicator} onChange={(e) => setForm({ ...form, indicator: e.target.value })} />
              <label>Meta (alvo)</label>
              <input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
              <label>Unidade</label>
              <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <label>Status</label>
              <select value={form.status_color} onChange={(e) => setForm({ ...form, status_color: e.target.value })}>
                {Object.entries(COLOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
              </select>
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

export default GestaoScorecard;

import { useState, useEffect } from 'react';
import { Plus, CheckSquare, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getApprovalRequests, createApprovalRequest, decideApprovalRequest } from '../../services/gestao/approvalService';
import { getStaff } from '../../services/gestao/teamService';
import './styles/Gestao.css';

const STATUS_LABELS = { PENDENTE: 'Pendente', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado', NAO_REQUER: '—' };

const GestaoApprovals = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', approver_id: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [reqData, staffData] = await Promise.all([getApprovalRequests(), getStaff()]);
    setRequests(Array.isArray(reqData) ? reqData : []);
    setStaff(Array.isArray(staffData) ? staffData : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const response = await createApprovalRequest({ ...form, approver_id: Number(form.approver_id) });
    setSaving(false);
    if (response.success === false) {
      alert(response.message || 'Erro ao criar solicitação.');
      return;
    }
    setShowModal(false);
    setForm({ title: '', description: '', approver_id: '' });
    load();
  };

  const handleDecide = async (id, status) => {
    const response = await decideApprovalRequest(id, status);
    if (response.success === false) {
      alert(response.message || 'Erro ao decidir.');
      return;
    }
    load();
  };

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  const toDecide = requests.filter((r) => r.approver?.id === user?.id && r.status === 'PENDENTE');
  const mine = requests.filter((r) => r.requester?.id === user?.id);

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><CheckSquare size={24} /> Aprovações</h1>
        <button className="gestao-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nova Solicitação
        </button>
      </header>

      <h3 className="gestao-section-title">Aguardando sua decisão</h3>
      {toDecide.length === 0 && <p className="gestao-empty">Nada esperando por você.</p>}
      <div className="gestao-approval-list">
        {toDecide.map((r) => (
          <div key={r.id} className="gestao-approval-card">
            <div>
              <strong>{r.title}</strong>
              <p className="gestao-project-desc">{r.description}</p>
              <span className="gestao-org-cargo">Pedido por {r.requester?.name}</span>
            </div>
            <div className="gestao-modal-actions">
              <button onClick={() => handleDecide(r.id, 'REJEITADO')}>Rejeitar</button>
              <button className="gestao-btn-primary" onClick={() => handleDecide(r.id, 'APROVADO')}>Aprovar</button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="gestao-section-title">Minhas solicitações</h3>
      {mine.length === 0 && <p className="gestao-empty">Você ainda não pediu nenhuma aprovação.</p>}
      <div className="gestao-approval-list">
        {mine.map((r) => (
          <div key={r.id} className="gestao-approval-card">
            <div>
              <strong>{r.title}</strong>
              <p className="gestao-project-desc">{r.description}</p>
              <span className="gestao-org-cargo">Aprovador: {r.approver?.name}</span>
            </div>
            <span className={`gestao-badge gestao-status-${r.status?.toLowerCase()}`}>{STATUS_LABELS[r.status]}</span>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="gestao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="gestao-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nova Solicitação de Aprovação</h2>
            <form onSubmit={handleCreate}>
              <label>Título</label>
              <input type="text" required minLength={2} maxLength={200}
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <label>Descrição</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <label>Aprovador</label>
              <select required value={form.approver_id} onChange={(e) => setForm({ ...form, approver_id: e.target.value })}>
                <option value="">Selecione...</option>
                {staff.filter((u) => u.id !== user?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <div className="gestao-modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="gestao-btn-primary" disabled={saving}>
                  {saving ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoApprovals;

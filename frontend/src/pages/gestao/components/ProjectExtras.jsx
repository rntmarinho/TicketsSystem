import { useState, useEffect } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import {
  getMilestones, createMilestone, updateMilestone, deleteMilestone,
  getRisks, createRisk, deleteRisk,
  getDecisions, createDecision, deleteDecision,
  getIdeas, createIdea, updateIdea, convertIdea,
} from '../../../services/gestao/projectExtrasService';

const RISK_LEVELS = ['BAIXO', 'MEDIO', 'ALTO'];
const IDEA_STATUS_LABELS = { NOVA: 'Nova', EM_ANALISE: 'Em análise', APROVADA: 'Aprovada', REJEITADA: 'Rejeitada', CONVERTIDA: 'Convertida' };

const MiniForm = ({ placeholder, onSubmit }) => {
  const [value, setValue] = useState('');
  return (
    <form
      className="gestao-comment-form"
      onSubmit={(e) => { e.preventDefault(); if (!value.trim()) return; onSubmit(value.trim()); setValue(''); }}
    >
      <input placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="submit" className="gestao-btn-primary"><Plus size={14} /></button>
    </form>
  );
};

const ProjectExtras = ({ projectId, canManage, onTaskCreated }) => {
  const [milestones, setMilestones] = useState([]);
  const [risks, setRisks] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [ideas, setIdeas] = useState([]);

  const load = async () => {
    const [m, r, d, i] = await Promise.all([
      getMilestones(projectId), getRisks(projectId), getDecisions(projectId), getIdeas(projectId),
    ]);
    setMilestones(Array.isArray(m) ? m : []);
    setRisks(Array.isArray(r) ? r : []);
    setDecisions(Array.isArray(d) ? d : []);
    setIdeas(Array.isArray(i) ? i : []);
  };

  useEffect(() => { load(); }, [projectId]);

  return (
    <div className="gestao-extras-grid">
      <section className="gestao-extras-section">
        <h4>Marcos</h4>
        {milestones.map((m) => (
          <div key={m.id} className="gestao-attachment-item">
            <span>
              <button className="gestao-icon-btn" onClick={async () => { await updateMilestone(m.id, { done: !m.done }); load(); }}>
                {m.done ? <Check size={14} color="#16a34a" /> : <span style={{ width: 14, display: 'inline-block' }} />}
              </button>
              {' '}<span style={{ textDecoration: m.done ? 'line-through' : 'none' }}>{m.title}</span>
            </span>
            {canManage && <button className="gestao-icon-btn" onClick={async () => { await deleteMilestone(m.id); load(); }}><Trash2 size={13} /></button>}
          </div>
        ))}
        {milestones.length === 0 && <p className="gestao-empty">Nenhum marco.</p>}
        {canManage && <MiniForm placeholder="Novo marco..." onSubmit={async (title) => { await createMilestone(projectId, { title }); load(); }} />}
      </section>

      <section className="gestao-extras-section">
        <h4>Riscos</h4>
        {risks.map((r) => (
          <div key={r.id} className="gestao-attachment-item">
            <span>{r.title} <span className="gestao-badge">{r.impact}/{r.probability}</span></span>
            {canManage && <button className="gestao-icon-btn" onClick={async () => { await deleteRisk(r.id); load(); }}><Trash2 size={13} /></button>}
          </div>
        ))}
        {risks.length === 0 && <p className="gestao-empty">Nenhum risco.</p>}
        {canManage && (
          <MiniForm placeholder="Novo risco..." onSubmit={async (title) => {
            await createRisk(projectId, { title, impact: RISK_LEVELS[1], probability: RISK_LEVELS[1] });
            load();
          }} />
        )}
      </section>

      <section className="gestao-extras-section">
        <h4>Decisões</h4>
        {decisions.map((d) => (
          <div key={d.id} className="gestao-attachment-item">
            <span>{d.title} <span style={{ opacity: 0.6 }}>— {d.decided_by?.name}</span></span>
            {canManage && <button className="gestao-icon-btn" onClick={async () => { await deleteDecision(d.id); load(); }}><Trash2 size={13} /></button>}
          </div>
        ))}
        {decisions.length === 0 && <p className="gestao-empty">Nenhuma decisão registrada.</p>}
        {canManage && <MiniForm placeholder="Nova decisão..." onSubmit={async (title) => { await createDecision(projectId, { title }); load(); }} />}
      </section>

      <section className="gestao-extras-section">
        <h4>Ideias</h4>
        {ideas.map((i) => (
          <div key={i.id} className="gestao-attachment-item">
            <span>{i.title} <span className="gestao-badge">{IDEA_STATUS_LABELS[i.status]}</span></span>
            {canManage && i.status !== 'CONVERTIDA' && (
              <button
                className="gestao-icon-btn" title="Converter em tarefa"
                onClick={async () => { const r = await convertIdea(i.id); if (r.success) { load(); onTaskCreated?.(); } }}
              >
                →✓
              </button>
            )}
          </div>
        ))}
        {ideas.length === 0 && <p className="gestao-empty">Nenhuma ideia registrada.</p>}
        <MiniForm placeholder="Nova ideia..." onSubmit={async (title) => { await createIdea(projectId, { title }); load(); }} />
      </section>
    </div>
  );
};

export default ProjectExtras;

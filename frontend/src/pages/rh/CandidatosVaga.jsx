import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { getVaga } from '../../services/rh/vagaService';
import { getCandidatos, createCandidato, updateCandidato } from '../../services/rh/candidatoService';
import CandidatoDrawer from './components/CandidatoDrawer';
import '../gestao/styles/Gestao.css';

// Kanban de candidatos por vaga (Bloco A do ATS, 19/09/2026) — mesma
// estrutura de frontend/src/pages/gestao/GestaoProjectDetail.jsx (@dnd-kit
// puro, COLUMNS fixo, update otimista + PATCH genérico no drag-and-drop).
// Etapas fixas (decisão da Renata) — REPROVADO é coluna terminal, não uma
// exclusão: o candidato continua visível pra histórico.
const COLUMNS = [
  { key: 'TRIAGEM', label: 'Triagem' },
  { key: 'ENTREVISTA_RH', label: 'Entrevista RH' },
  { key: 'ENTREVISTA_GESTOR', label: 'Entrevista Gestor' },
  { key: 'PROPOSTA', label: 'Proposta' },
  { key: 'CONTRATADO', label: 'Contratado' },
  { key: 'REPROVADO', label: 'Reprovado' },
];

const CandidatoCard = ({ candidato, onOpen }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: candidato.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`gestao-kanban-card${isDragging ? ' dragging' : ''}`}
      onClick={() => onOpen(candidato)}
    >
      <div className="gestao-kanban-card-title">{candidato.nome}</div>
      <div className="gestao-kanban-card-meta">
        <span>{candidato.origem || '—'}</span>
      </div>
    </div>
  );
};

const CandidatoColumn = ({ column, candidatos, onOpen }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <div ref={setNodeRef} className="gestao-kanban-column" style={isOver ? { outline: '2px solid var(--accent)' } : undefined}>
      <div className="gestao-kanban-column-title">
        <span>{column.label}</span>
        <span>{candidatos.length}</span>
      </div>
      {candidatos.map((c) => <CandidatoCard key={c.id} candidato={c} onOpen={onOpen} />)}
    </div>
  );
};

const CandidatosVaga = () => {
  const { id } = useParams();
  const [vaga, setVaga] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [openCandidato, setOpenCandidato] = useState(null);
  const [novoNome, setNovoNome] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    const [vagaData, candidatosData] = await Promise.all([getVaga(id), getCandidatos(id)]);
    setVaga(vagaData);
    setCandidatos(Array.isArray(candidatosData) ? candidatosData : []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    const novaEtapa = over.id;
    const candidato = candidatos.find((c) => c.id === active.id);
    if (!candidato || candidato.etapa === novaEtapa) return;

    setCandidatos((prev) => prev.map((c) => (c.id === active.id ? { ...c, etapa: novaEtapa } : c)));
    const response = await updateCandidato(active.id, { etapa: novaEtapa });
    if (response.success === false) {
      alert(response.message || 'Não foi possível mover o candidato.');
      load();
    }
  };

  const handleQuickCreate = async (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    const response = await createCandidato(id, { nome: novoNome.trim() });
    if (response.success === false) {
      alert(response.message || 'Erro ao cadastrar candidato.');
      return;
    }
    setNovoNome('');
    load();
  };

  if (!vaga) return <div className="gestao-loading">Carregando...</div>;

  return (
    <div className="gestao-container">
      <Link to="/rh" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--text)' }}>
        <ArrowLeft size={16} /> Fila de Vagas
      </Link>
      <header className="gestao-header gestao-header--hero">
        <div>
          <div className="gestao-eyebrow">ATS · CANDIDATOS</div>
          <h1>{vaga.cargo}</h1>
          <p className="gestao-subtitle">{vaga.centro_custo_descricao || vaga.centro_custo}</p>
        </div>
      </header>

      <form onSubmit={handleQuickCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-h)' }}
          placeholder="Nome do candidato..." value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
        />
        <button type="submit" className="gestao-btn-primary"><Plus size={16} /> Adicionar</button>
      </form>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="gestao-kanban">
          {COLUMNS.map((col) => (
            <CandidatoColumn
              key={col.key} column={col}
              candidatos={candidatos.filter((c) => c.etapa === col.key)}
              onOpen={setOpenCandidato}
            />
          ))}
        </div>
      </DndContext>

      {openCandidato && (
        <CandidatoDrawer
          candidato={openCandidato}
          onClose={() => setOpenCandidato(null)}
          onChanged={load}
        />
      )}
    </div>
  );
};

export default CandidatosVaga;

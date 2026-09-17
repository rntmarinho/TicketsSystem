import { useState, useEffect, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { getVagas, decidirVaga, cancelVaga, marcarVagaCriada } from '../../services/rh/vagaService';
import VagaKanbanDrawer from './components/VagaKanbanDrawer';
import '../gestao/styles/Gestao.css';

// Kanban geral de vagas (17/09/2026) -- mesma estrutura de
// frontend/src/pages/gestao/GestaoKanbanGeral.jsx (@dnd-kit puro), mas aqui
// cada card é a VAGA inteira (não candidato -- isso já existe em
// /rh/vagas/:id/candidatos) e as colunas são o status da vaga. Cada
// transição de status já tem endpoint dedicado com regra própria (quem
// decide, quem cancela, exigir motivo) -- não existe nem deve existir um
// PATCH genérico de status (deixaria pular a aprovação arrastando direto
// pra Vaga Criada). Por isso não há update otimista aqui: o card só se move
// depois que o backend confirma a transição específica.
const COLUMNS = [
  { key: 'PENDENTE_APROVACAO', label: 'Pendente Aprovação' },
  { key: 'APROVADA', label: 'Aprovada' },
  { key: 'VAGA_CRIADA', label: 'Vaga Criada' },
  { key: 'REPROVADA', label: 'Reprovada' },
  { key: 'CANCELADA', label: 'Cancelada' },
];

const VagaCard = ({ vaga, onOpen }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: vaga.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`gestao-kanban-card${isDragging ? ' dragging' : ''}`}
      onClick={() => onOpen(vaga)}
    >
      <div className="gestao-kanban-card-title">
        {vaga.vaga_sigilosa && <Lock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
        {vaga.cargo}
      </div>
      <div className="gestao-kanban-card-meta">
        <span>{vaga.centro_custo_descricao || vaga.centro_custo}</span>
        <span>{vaga.requester?.name?.split(' ')[0] || '—'}</span>
      </div>
    </div>
  );
};

const VagaColumn = ({ column, vagas, onOpen }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <div ref={setNodeRef} className="gestao-kanban-column" style={isOver ? { outline: '2px solid var(--accent)' } : undefined}>
      <div className="gestao-kanban-column-title">
        <span>{column.label}</span>
        <span>{vagas.length}</span>
      </div>
      {vagas.map((v) => <VagaCard key={v.id} vaga={v} onOpen={onOpen} />)}
    </div>
  );
};

// Única transição válida por par (status atual -> status ao soltar) e qual
// ação de negócio ela representa -- qualquer combinação fora daqui é
// recusada sem chamar a API.
const TRANSICOES = {
  'PENDENTE_APROVACAO->APROVADA': 'aprovar',
  'PENDENTE_APROVACAO->REPROVADA': 'reprovar',
  'PENDENTE_APROVACAO->CANCELADA': 'cancelar',
  'APROVADA->VAGA_CRIADA': 'marcar_criada',
};

const KanbanVagas = () => {
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openVaga, setOpenVaga] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    const data = await getVagas();
    setVagas(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    const destino = over.id;
    const vaga = vagas.find((v) => v.id === active.id);
    if (!vaga || vaga.status === destino) return;

    const transicao = TRANSICOES[`${vaga.status}->${destino}`];
    if (!transicao) {
      alert('Essa mudança de status não é permitida por aqui.');
      return;
    }

    let resultado;
    if (transicao === 'aprovar') {
      resultado = await decidirVaga(vaga.id, 'APROVADA', '');
    } else if (transicao === 'reprovar') {
      const motivo = window.prompt('Motivo da reprovação (obrigatório):') || '';
      if (!motivo.trim()) return;
      resultado = await decidirVaga(vaga.id, 'REPROVADA', motivo);
    } else if (transicao === 'cancelar') {
      if (!window.confirm('Cancelar esta solicitação de vaga? Essa ação não pode ser desfeita.')) return;
      resultado = await cancelVaga(vaga.id);
    } else if (transicao === 'marcar_criada') {
      const referencia = window.prompt('Referência da vaga no Senior (opcional):') || '';
      resultado = await marcarVagaCriada(vaga.id, referencia.trim() || null);
    }

    if (!resultado?.success) {
      alert(resultado?.message || 'Não foi possível mudar o status.');
      return;
    }
    load();
  };

  if (loading) return <div className="gestao-loading">Carregando…</div>;

  return (
    <div className="gestao-container">
      <header className="gestao-header gestao-header--hero">
        <div>
          <div className="gestao-eyebrow">GESTÃO DE PESSOAS</div>
          <h1>Kanban de Vagas</h1>
          <p className="gestao-subtitle">Arraste um card pra mudar o status, ou clique pra ver detalhes e mais ações.</p>
        </div>
      </header>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="gestao-kanban">
          {COLUMNS.map((col) => (
            <VagaColumn
              key={col.key} column={col}
              vagas={vagas.filter((v) => v.status === col.key)}
              onOpen={setOpenVaga}
            />
          ))}
        </div>
      </DndContext>

      {openVaga && (
        <VagaKanbanDrawer
          vaga={openVaga}
          onClose={() => setOpenVaga(null)}
          onChanged={load}
        />
      )}
    </div>
  );
};

export default KanbanVagas;

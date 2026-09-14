import { useState, useEffect, useMemo, useCallback } from 'react';
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Network, Loader2, GripVertical } from 'lucide-react';
import { getOrganograma } from '../../services/gestao/nucleoService';
import { updateUser } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import './styles/Gestao.css';

const NIVEL_LABELS = {
  DIRETORIA: 'Diretoria', GERENCIA: 'Gerência', COORDENACAO: 'Coordenação',
  SUPERVISOR: 'Supervisor', COLABORADOR: 'Colaborador',
};

const ROOT_DROPZONE_ID = '__root__';

// Sobe recursivamente todos os descendentes de rootId — usado pra bloquear
// visualmente (e antes de chamar a API) um drop que criaria ciclo.
function collectDescendantIds(rootId, byManager, acc) {
  const children = byManager.get(rootId) || [];
  for (const c of children) {
    acc.add(c.id);
    collectDescendantIds(c.id, byManager, acc);
  }
  return acc;
}

function CardContent({ user }) {
  return (
    <>
      <strong>{user.name}</strong>
      {user.cargo && <span className="gestao-org-cargo"> — {user.cargo}</span>}
      {user.nivel_hierarquico && <span className="gestao-badge">{NIVEL_LABELS[user.nivel_hierarquico] || user.nivel_hierarquico}</span>}
      {user.nucleo && <span className="gestao-badge gestao-badge-nucleo">{user.nucleo.name}</span>}
      {(user.ramal || user.whatsapp) && (
        <span className="gestao-org-contact">
          {user.ramal && `Ramal ${user.ramal}`}{user.ramal && user.whatsapp && ' · '}{user.whatsapp}
        </span>
      )}
    </>
  );
}

function OrgNode({ user, byManager, depth, editable, activeId, overId, invalidTargetIds, savingId }) {
  const children = byManager.get(user.id) || [];
  const canInteract = editable && savingId == null;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: user.id, disabled: !canInteract });
  const { setNodeRef: setDropRef } = useDroppable({ id: user.id, disabled: !canInteract });
  const setRefs = useCallback((node) => { setDragRef(node); setDropRef(node); }, [setDragRef, setDropRef]);

  const isOver = overId === user.id;
  const isInvalidTarget = activeId != null && invalidTargetIds.has(user.id);
  const isSaving = savingId === user.id;

  const classes = ['gestao-org-card'];
  if (editable) classes.push('gestao-org-card-editable');
  if (isDragging) classes.push('gestao-org-card-dragging');
  if (isSaving) classes.push('gestao-org-card-saving');
  if (isOver) classes.push(isInvalidTarget ? 'gestao-org-card-dropbad' : 'gestao-org-card-dropok');

  return (
    <div className="gestao-org-node" style={{ marginLeft: depth * 22 }}>
      <div
        ref={setRefs}
        className={classes.join(' ')}
        {...(canInteract ? listeners : {})}
        {...(canInteract ? attributes : {})}
      >
        {editable && <GripVertical size={14} className="gestao-org-drag-handle" aria-hidden="true" />}
        <CardContent user={user} />
        {isSaving && <span className="gestao-org-saving-label">salvando…</span>}
      </div>
      {children.map((c) => (
        <OrgNode
          key={c.id}
          user={c}
          byManager={byManager}
          depth={depth + 1}
          editable={editable}
          activeId={activeId}
          overId={overId}
          invalidTargetIds={invalidTargetIds}
          savingId={savingId}
        />
      ))}
    </div>
  );
}

function RootDropzone({ overId }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROPZONE_ID });
  return (
    <div
      ref={setNodeRef}
      className={`gestao-org-root-dropzone${isOver || overId === ROOT_DROPZONE_ID ? ' gestao-org-card-dropok' : ''}`}
    >
      Soltar aqui pra remover o gestor imediato (virar raiz do organograma)
    </div>
  );
}

const GestaoOrgChart = () => {
  const { role } = useAuth();
  const editable = role === 'ADMIN';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  // distance mínima antes de considerar arraste, pra não disparar em cliques
  // normais — dnd-kit trabalha com pointer events, não o drag nativo do
  // navegador (que se mostrou inconsistente entre navegador/mouse/config).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    getOrganograma().then((data) => {
      setUsers(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const { roots, byManager } = useMemo(() => {
    const ids = new Set(users.map((u) => u.id));
    const byManager = new Map();
    const roots = [];
    for (const u of users) {
      if (u.gestor_imediato_id && ids.has(u.gestor_imediato_id)) {
        if (!byManager.has(u.gestor_imediato_id)) byManager.set(u.gestor_imediato_id, []);
        byManager.get(u.gestor_imediato_id).push(u);
      } else {
        roots.push(u);
      }
    }
    return { roots, byManager };
  }, [users]);

  // Alvos de drop proibidos pra quem está sendo arrastado: ele mesmo e todos
  // os seus subordinados (soltar ali criaria um ciclo na árvore).
  const invalidTargetIds = useMemo(() => {
    if (activeId == null) return new Set();
    return collectDescendantIds(activeId, byManager, new Set([activeId]));
  }, [activeId, byManager]);

  const activeUser = activeId != null ? users.find((u) => u.id === activeId) : null;

  async function applyNewManager(userId, newManagerId) {
    setSavingId(userId);
    try {
      const response = await updateUser(userId, { gestor_imediato_id: newManagerId });
      if (!response?.success) {
        alert(response?.message || 'Erro ao atualizar o gestor imediato.');
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, gestor_imediato_id: newManagerId } : u)));
    } catch {
      alert('Erro de conexão ao atualizar o organograma.');
    } finally {
      setSavingId(null);
    }
  }

  const handleDragStart = (event) => setActiveId(event.active.id);
  const handleDragOver = (event) => setOverId(event.over ? event.over.id : null);
  const handleDragCancel = () => { setActiveId(null); setOverId(null); };

  const handleDragEnd = (event) => {
    const sourceId = event.active.id;
    const targetId = event.over ? event.over.id : null;
    setActiveId(null);
    setOverId(null);
    if (targetId == null || sourceId === targetId) return;

    if (targetId === ROOT_DROPZONE_ID) {
      const draggedUser = users.find((u) => u.id === sourceId);
      if (!draggedUser?.gestor_imediato_id) return; // já é raiz
      applyNewManager(sourceId, null);
      return;
    }

    if (invalidTargetIds.has(targetId)) {
      alert('Não é possível soltar aqui: isso criaria um ciclo na hierarquia (o destino é subordinado da pessoa arrastada).');
      return;
    }
    const draggedUser = users.find((u) => u.id === sourceId);
    if (draggedUser?.gestor_imediato_id === targetId) return; // já é o gestor, nada a fazer
    applyNewManager(sourceId, targetId);
  };

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="gestao-container">
        <header className="gestao-header">
          <h1><Network size={24} /> Organograma</h1>
        </header>
        <p className="gestao-hint">
          {editable
            ? 'Arraste uma pessoa e solte sobre outra pra definir o gestor imediato. Sem gestor/cargo preenchido, ela aparece solta na raiz.'
            : 'Sem gestor imediato/cargo preenchido, todo mundo aparece solto na raiz — peça pro TI editar o perfil em Usuários pra montar a árvore.'}
        </p>
        {editable && activeId != null && <RootDropzone overId={overId} />}
        <div className="gestao-org-tree">
          {roots.map((u) => (
            <OrgNode
              key={u.id}
              user={u}
              byManager={byManager}
              depth={0}
              editable={editable}
              activeId={activeId}
              overId={overId}
              invalidTargetIds={invalidTargetIds}
              savingId={savingId}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeUser ? (
          <div className="gestao-org-card gestao-org-card-overlay">
            <GripVertical size={14} className="gestao-org-drag-handle" aria-hidden="true" />
            <CardContent user={activeUser} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default GestaoOrgChart;

import { useState, useEffect } from 'react';
import { X, Lock, Unlock, Paperclip, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  getTask, updateTask, deleteTask, createComment, createDependency, deleteDependency,
} from '../../../services/gestao/taskService';
import {
  getTaskAttachments, uploadTaskAttachment, getDownloadUrl, deleteAttachment,
} from '../../../services/gestao/attachmentService';

const STATUS_OPTIONS = [
  { value: 'A_FAZER', label: 'A Fazer' },
  { value: 'FAZENDO', label: 'Fazendo' },
  { value: 'BLOQUEADO', label: 'Bloqueado' },
  { value: 'FEITO', label: 'Feito' },
];
const PRIORITY_OPTIONS = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
];

const toInputDate = (iso) => (iso ? iso.slice(0, 10) : '');

const TaskDrawer = ({ taskId, staff, onClose, onChanged }) => {
  const { user, role } = useAuth();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [predecessorId, setPredecessorId] = useState('');

  const canModify = task && (
    role === 'ADMIN' || role === 'GESTOR_PROJETO' ||
    (role === 'COLABORADOR' && !task.locked && task.assignee_id === user?.id)
  );
  const canLock = ['ADMIN', 'GESTOR_PROJETO'].includes(role);

  const load = async () => {
    const data = await getTask(taskId);
    if (data && data.success !== false) {
      setTask(data);
      setComments(data.comments || []);
    }
    const atts = await getTaskAttachments(taskId);
    setAttachments(Array.isArray(atts) ? atts : []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [taskId]);

  const patch = async (fields) => {
    const response = await updateTask(taskId, fields);
    if (response.success === false) {
      alert(response.message || 'Erro ao salvar.');
      return;
    }
    setTask(response.task);
    onChanged?.();
  };

  const handleDelete = async () => {
    if (!window.confirm('Excluir esta tarefa?')) return;
    const response = await deleteTask(taskId);
    if (response.success === false) {
      alert(response.message || 'Erro ao excluir.');
      return;
    }
    onChanged?.();
    onClose();
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const response = await createComment(taskId, newComment.trim());
    if (response.success !== false) {
      setComments([...comments, response.comment]);
      setNewComment('');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const response = await uploadTaskAttachment(taskId, file);
    if (response.success === false) {
      alert(response.message || 'Erro ao enviar anexo.');
      return;
    }
    setAttachments([...attachments, response.attachment]);
    e.target.value = '';
  };

  const handleDeleteAttachment = async (id) => {
    const response = await deleteAttachment(id);
    if (response.success !== false) {
      setAttachments(attachments.filter((a) => a.id !== id));
    }
  };

  const handleAddDependency = async (e) => {
    e.preventDefault();
    if (!predecessorId) return;
    const response = await createDependency(taskId, { predecessor_id: predecessorId });
    if (response.success === false) {
      alert(response.message || 'Erro ao adicionar dependência.');
      return;
    }
    setPredecessorId('');
    load();
  };

  const handleRemoveDependency = async (id) => {
    const response = await deleteDependency(id);
    if (response.success !== false) load();
  };

  if (!task) return null;

  return (
    <div className="gestao-drawer-overlay" onClick={onClose}>
      <div className="gestao-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="gestao-drawer-close" onClick={onClose}><X size={20} /></button>
        <h2>
          {task.locked ? <Lock size={16} className="gestao-locked-icon" /> : null}
          {' '}{task.title}
        </h2>

        <div className="gestao-drawer-field">
          <label>Título</label>
          <input
            defaultValue={task.title} disabled={!canModify}
            onBlur={(e) => e.target.value !== task.title && patch({ title: e.target.value })}
          />
        </div>

        <div className="gestao-drawer-field">
          <label>Descrição</label>
          <textarea
            defaultValue={task.description || ''} disabled={!canModify}
            onBlur={(e) => e.target.value !== (task.description || '') && patch({ description: e.target.value })}
          />
        </div>

        <div className="gestao-drawer-field">
          <label>Status</label>
          <select value={task.status} disabled={!canModify} onChange={(e) => patch({ status: e.target.value })}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="gestao-drawer-field">
          <label>Prioridade</label>
          <select value={task.priority} disabled={!canModify} onChange={(e) => patch({ priority: e.target.value })}>
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="gestao-drawer-field">
          <label>Responsável</label>
          <select
            value={task.assignee_id || ''} disabled={!canModify}
            onChange={(e) => patch({ assignee_id: e.target.value || null })}
          >
            <option value="">Sem responsável</option>
            {(staff || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div className="gestao-drawer-field" style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label>Início</label>
            <input
              type="date" defaultValue={toInputDate(task.start_date)} disabled={!canModify}
              onBlur={(e) => patch({ start_date: e.target.value ? `${e.target.value}T00:00:00` : null })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Prazo</label>
            <input
              type="date" defaultValue={toInputDate(task.due_date)} disabled={!canModify}
              onBlur={(e) => patch({ due_date: e.target.value ? `${e.target.value}T00:00:00` : null })}
            />
          </div>
        </div>

        <div className="gestao-drawer-field">
          <label>Duração (dias)</label>
          <input
            type="number" min="0" defaultValue={task.duration_days ?? ''} disabled={!canModify}
            onBlur={(e) => patch({ duration_days: e.target.value ? Number(e.target.value) : null })}
          />
        </div>

        {canLock && (
          <button
            className="gestao-add-task-inline"
            onClick={() => patch({ locked: !task.locked })}
          >
            {task.locked ? <><Unlock size={14} /> Destravar tarefa</> : <><Lock size={14} /> Travar tarefa</>}
          </button>
        )}

        <div className="gestao-drawer-section">
          <h4>Dependências</h4>
          {(task.predecessor_links || []).map((d) => (
            <div key={d.id} className="gestao-dependency-item">
              <span>{d.predecessor_title} ({d.type})</span>
              {canModify && <button onClick={() => handleRemoveDependency(d.id)}><Trash2 size={14} /></button>}
            </div>
          ))}
          {canModify && (
            <form className="gestao-comment-form" onSubmit={handleAddDependency}>
              <input
                placeholder="ID da tarefa predecessora"
                value={predecessorId}
                onChange={(e) => setPredecessorId(e.target.value)}
              />
              <button type="submit">Adicionar</button>
            </form>
          )}
        </div>

        <div className="gestao-drawer-section">
          <h4><Paperclip size={14} /> Anexos</h4>
          {attachments.map((a) => (
            <div key={a.id} className="gestao-attachment-item">
              <a href={getDownloadUrl(a.id)} target="_blank" rel="noreferrer">{a.file_name}</a>
              {(role === 'ADMIN' || a.uploaded_by?.id === user?.id) && (
                <button onClick={() => handleDeleteAttachment(a.id)}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
          <label className="gestao-add-task-inline" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
            <Upload size={14} /> Enviar anexo
            <input type="file" style={{ display: 'none' }} onChange={handleUpload} />
          </label>
        </div>

        <div className="gestao-drawer-section">
          <h4>Comentários</h4>
          {comments.map((c) => (
            <div key={c.id} className="gestao-comment">
              <div className="gestao-comment-author">{c.author?.name}</div>
              <div>{c.body}</div>
            </div>
          ))}
          <form className="gestao-comment-form" onSubmit={handleAddComment}>
            <input
              placeholder="Escreva um comentário..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button type="submit">Enviar</button>
          </form>
        </div>

        {['ADMIN', 'GESTOR_PROJETO'].includes(role) && !task.locked && (
          <button
            className="gestao-add-task-inline"
            style={{ marginTop: '20px', color: '#dc2626', borderColor: '#dc2626' }}
            onClick={handleDelete}
          >
            <Trash2 size={14} /> Excluir tarefa
          </button>
        )}
      </div>
    </div>
  );
};

export default TaskDrawer;

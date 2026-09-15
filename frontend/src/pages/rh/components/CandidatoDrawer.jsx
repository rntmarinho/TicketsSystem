import { useState, useEffect } from 'react';
import { X, Paperclip, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  updateCandidato, deleteCandidato, getComentarios, createComentario,
  getCandidatoAttachments, uploadCandidatoAttachment, getCandidatoAttachmentDownloadUrl, deleteCandidatoAttachment,
} from '../../../services/rh/candidatoService';

const ETAPA_OPTIONS = [
  { value: 'TRIAGEM', label: 'Triagem' },
  { value: 'ENTREVISTA_RH', label: 'Entrevista RH' },
  { value: 'ENTREVISTA_GESTOR', label: 'Entrevista Gestor' },
  { value: 'PROPOSTA', label: 'Proposta' },
  { value: 'CONTRATADO', label: 'Contratado' },
  { value: 'REPROVADO', label: 'Reprovado' },
];

// Drawer do candidato (Bloco A do ATS, 19/09/2026) — mesmo chrome visual do
// TaskDrawer.jsx (gestao-drawer-*), mas o candidato em si vem por prop (a
// tela mãe, CandidatosVaga.jsx, já tem a lista carregada) em vez de um GET
// individual, que não existe pra esse recurso (só list por vaga).
const CandidatoDrawer = ({ candidato: candidatoInicial, onClose, onChanged }) => {
  const { user, role } = useAuth();
  const [candidato, setCandidato] = useState(candidatoInicial);
  const [comentarios, setComentarios] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [newComentario, setNewComentario] = useState('');

  const load = async () => {
    const [coms, atts] = await Promise.all([
      getComentarios(candidato.id),
      getCandidatoAttachments(candidato.id),
    ]);
    setComentarios(Array.isArray(coms) ? coms : []);
    setAttachments(Array.isArray(atts) ? atts : []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [candidato.id]);

  const patch = async (fields) => {
    const response = await updateCandidato(candidato.id, fields);
    if (response.success === false) {
      alert(response.message || 'Erro ao salvar.');
      return;
    }
    setCandidato(response.candidato);
    onChanged?.();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Excluir o candidato "${candidato.nome}"? Essa ação não pode ser desfeita.`)) return;
    const response = await deleteCandidato(candidato.id);
    if (response.success === false) {
      alert(response.message || 'Erro ao excluir.');
      return;
    }
    onChanged?.();
    onClose();
  };

  const handleAddComentario = async (e) => {
    e.preventDefault();
    if (!newComentario.trim()) return;
    const response = await createComentario(candidato.id, newComentario.trim());
    if (response.success !== false) {
      setComentarios([...comentarios, response.comentario]);
      setNewComentario('');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const response = await uploadCandidatoAttachment(candidato.id, file);
    if (response.success === false) {
      alert(response.message || 'Erro ao enviar o currículo.');
      return;
    }
    setAttachments([...attachments, response.attachment]);
    e.target.value = '';
  };

  const handleDeleteAttachment = async (id) => {
    const response = await deleteCandidatoAttachment(id);
    if (response.success !== false) {
      setAttachments(attachments.filter((a) => a.id !== id));
    }
  };

  return (
    <div className="gestao-drawer-overlay" onClick={onClose}>
      <div className="gestao-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="gestao-drawer-close" onClick={onClose}><X size={20} /></button>
        <h2>{candidato.nome}</h2>

        <div className="gestao-drawer-field">
          <label>Nome</label>
          <input
            defaultValue={candidato.nome}
            onBlur={(e) => e.target.value.trim() && e.target.value !== candidato.nome && patch({ nome: e.target.value.trim() })}
          />
        </div>

        <div className="gestao-drawer-field">
          <label>E-mail</label>
          <input
            type="email" defaultValue={candidato.email || ''}
            onBlur={(e) => e.target.value !== (candidato.email || '') && patch({ email: e.target.value })}
          />
        </div>

        <div className="gestao-drawer-field">
          <label>Telefone</label>
          <input
            defaultValue={candidato.telefone || ''}
            onBlur={(e) => e.target.value !== (candidato.telefone || '') && patch({ telefone: e.target.value })}
          />
        </div>

        <div className="gestao-drawer-field">
          <label>Origem</label>
          <input
            placeholder="LinkedIn, indicação, banco de currículos..." defaultValue={candidato.origem || ''}
            onBlur={(e) => e.target.value !== (candidato.origem || '') && patch({ origem: e.target.value })}
          />
        </div>

        <div className="gestao-drawer-field">
          <label>Etapa</label>
          <select value={candidato.etapa} onChange={(e) => patch({ etapa: e.target.value })}>
            {ETAPA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {candidato.etapa === 'REPROVADO' && (
          <div className="gestao-drawer-field">
            <label>Motivo da reprovação</label>
            <textarea
              defaultValue={candidato.motivo_reprovacao || ''}
              onBlur={(e) => e.target.value !== (candidato.motivo_reprovacao || '') && patch({ motivo_reprovacao: e.target.value })}
            />
          </div>
        )}

        <div className="gestao-drawer-section">
          <h4><Paperclip size={14} /> Currículo / Anexos</h4>
          {attachments.map((a) => (
            <div key={a.id} className="gestao-attachment-item">
              <a href={getCandidatoAttachmentDownloadUrl(a.id)} target="_blank" rel="noreferrer">{a.file_name}</a>
              {(role === 'ADMIN' || a.uploaded_by?.id === user?.id) && (
                <button onClick={() => handleDeleteAttachment(a.id)}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
          <label className="gestao-add-task-inline" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
            <Upload size={14} /> Enviar currículo
            <input type="file" style={{ display: 'none' }} onChange={handleUpload} />
          </label>
        </div>

        <div className="gestao-drawer-section">
          <h4>Comentários</h4>
          {comentarios.map((c) => (
            <div key={c.id} className="gestao-comment">
              <div className="gestao-comment-author">{c.author?.name}</div>
              <div>{c.body}</div>
            </div>
          ))}
          <form className="gestao-comment-form" onSubmit={handleAddComentario}>
            <input
              placeholder="Nota de entrevista, feedback..."
              value={newComentario}
              onChange={(e) => setNewComentario(e.target.value)}
            />
            <button type="submit">Enviar</button>
          </form>
        </div>

        <button
          className="gestao-add-task-inline"
          style={{ marginTop: '20px', color: '#dc2626', borderColor: '#dc2626' }}
          onClick={handleDelete}
        >
          <Trash2 size={14} /> Excluir candidato
        </button>
      </div>
    </div>
  );
};

export default CandidatoDrawer;

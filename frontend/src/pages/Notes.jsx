import { useEffect, useRef, useState } from 'react';
import {
  StickyNote, Plus, X, Trash2, Bold, Italic, Pilcrow, List, ListOrdered
} from 'lucide-react';
import { getNotes, createNote, updateNote, deleteNote } from '../services/noteService';
import { useAuth } from '../context/AuthContext';
import './styles/Notes.css';

const CORES = ['#fff9c4', '#f8bbd0', '#bbdefb', '#c8e6c9', '#ffe0b2', '#e1bee7'];

const TABS = [
  { key: 'pessoal', label: 'Pessoal' },
  { key: 'setor', label: 'Setor' },
];

const fmtData = (val) => {
  if (!val) return '';
  const d = new Date(val.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const Notes = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pessoal');
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [titleInput, setTitleInput] = useState('');
  const [colorInput, setColorInput] = useState(CORES[0]);
  const [saving, setSaving] = useState(false);

  const editorRef = useRef(null);

  const loadNotes = async (scope) => {
    setLoading(true);
    try {
      const data = await getNotes(scope);
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotes(activeTab); }, [activeTab]);

  const openEditor = (note = null) => {
    setEditingNote(note);
    setTitleInput(note?.title || '');
    setColorInput(note?.color || CORES[0]);
    setModalOpen(true);
    // O contentEditable ainda não existe no DOM até o modal renderizar —
    // preenche o HTML inicial no próximo tick.
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = note?.content || '';
    }, 0);
  };

  const closeEditor = () => {
    setModalOpen(false);
    setEditingNote(null);
    setTitleInput('');
    setColorInput(CORES[0]);
  };

  const exec = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!titleInput.trim()) return;

    setSaving(true);
    try {
      const payload = {
        title: titleInput.trim(),
        content: editorRef.current?.innerHTML || '',
        color: colorInput,
        scope: activeTab
      };

      const response = editingNote
        ? await updateNote(editingNote.id, payload)
        : await createNote(payload);

      if (response.success === false) {
        alert(response.message || 'Erro ao salvar anotação.');
        return;
      }

      closeEditor();
      loadNotes(activeTab);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note) => {
    if (!window.confirm(`Excluir a anotação "${note.title}"?`)) return;
    await deleteNote(note.id);
    loadNotes(activeTab);
  };

  const podeEditar = (note) => activeTab === 'setor' || note.owner_id === user?.id;

  return (
    <div className="notes-container">
      <header className="notes-header">
        <div className="notes-title-block">
          <StickyNote size={24} />
          <h1>Anotações</h1>
        </div>
        <button className="notes-btn-new" onClick={() => openEditor()}>
          <Plus size={18} /> Nova Anotação
        </button>
      </header>

      <nav className="notes-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`notes-tab ${activeTab === tab.key ? 'notes-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'pessoal' && (
        <p className="notes-hint">Só você vê as anotações desta aba.</p>
      )}
      {activeTab === 'setor' && (
        <p className="notes-hint">Todos os técnicos e admins veem e editam as anotações desta aba.</p>
      )}

      {loading ? (
        <p className="notes-empty">Carregando...</p>
      ) : notes.length === 0 ? (
        <p className="notes-empty">Nenhuma anotação nesta aba ainda.</p>
      ) : (
        <div className="notes-grid">
          {notes.map(note => (
            <div
              key={note.id}
              className="note-card"
              style={{ background: note.color }}
              onClick={() => podeEditar(note) && openEditor(note)}
            >
              <div className="note-card-header">
                <h3>{note.title}</h3>
                {podeEditar(note) && (
                  <button
                    className="note-delete-btn"
                    onClick={e => { e.stopPropagation(); handleDelete(note); }}
                    aria-label="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div
                className="note-card-content"
                dangerouslySetInnerHTML={{ __html: note.content || '' }}
              />
              <div className="note-card-footer">
                {activeTab === 'setor' && <span>{note.owner_name}</span>}
                <span>{fmtData(note.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeEditor}>
          <div className="modal-content note-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{editingNote ? 'Editar Anotação' : 'Nova Anotação'}</h2>
                <p>{activeTab === 'pessoal' ? 'Só você vai ver esta anotação.' : 'Compartilhada com todos os técnicos e admins.'}</p>
              </div>
              <button className="btn-close" onClick={closeEditor}><X size={20} /></button>
            </div>

            <form className="modal-form" onSubmit={handleSave}>
              <div className="form-group">
                <label>Título</label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Cor</label>
                <div className="note-color-picker">
                  {CORES.map(cor => (
                    <button
                      type="button"
                      key={cor}
                      className={`note-color-swatch ${colorInput === cor ? 'note-color-swatch--active' : ''}`}
                      style={{ background: cor }}
                      onClick={() => setColorInput(cor)}
                      aria-label={cor}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Texto</label>
                <div className="note-editor-toolbar">
                  <button type="button" onClick={() => exec('bold')} title="Negrito"><Bold size={15} /></button>
                  <button type="button" onClick={() => exec('italic')} title="Itálico"><Italic size={15} /></button>
                  <button type="button" onClick={() => exec('formatBlock', '<p>')} title="Parágrafo"><Pilcrow size={15} /></button>
                  <button type="button" onClick={() => exec('insertUnorderedList')} title="Tópicos"><List size={15} /></button>
                  <button type="button" onClick={() => exec('insertOrderedList')} title="Enumeração"><ListOrdered size={15} /></button>
                </div>
                <div
                  ref={editorRef}
                  className="note-editor-body"
                  contentEditable
                  suppressContentEditableWarning
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeEditor}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notes;

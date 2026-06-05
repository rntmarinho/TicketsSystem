import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Calendar,
  User,
  Info,
  Tag,
  AlertCircle,
  Clock,
  Trash2,
  Send,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import TicketAnexos from './TicketAnexos';
import { apiFetch } from '../services/api';
import './styles/TicketDetails.css';

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Aberto'         },
  { value: 'in_progress', label: 'Em atendimento'  },
  { value: 'pending',     label: 'Pendente'        },
  { value: 'closed',      label: 'Fechado'         }
];

const emptyFormData = {
  subject:     '',
  status:      'open',
  category_id: '',
  priority_id: '',
  user_id:     '',
  creation:    '',
  sla:         ''
};

/* ── Gera uma cor de avatar determinística a partir do nome ─────────── */
const avatarColor = name => {
  const palette = [
    '#2563eb', '#16a34a', '#dc2626', '#d97706',
    '#7c3aed', '#0891b2', '#be185d', '#059669'
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const TicketDetails = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [error,          setError]          = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [users,      setUsers]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [messages,   setMessages]   = useState([]);

  const [newMessage, setNewMessage] = useState('');
  const [formData,   setFormData]   = useState(emptyFormData);

  /* ── Memo helpers ─────────────────────────────────────────────────── */
  const selectedUser = useMemo(() =>
    users.find(u => Number(u.id) === Number(formData.user_id)),
    [users, formData.user_id]
  );

  const selectedCategory = useMemo(() =>
    categories.find(c => Number(c.id) === Number(formData.category_id)),
    [categories, formData.category_id]
  );

  const selectedPriority = useMemo(() =>
    priorities.find(p => Number(p.id) === Number(formData.priority_id)),
    [priorities, formData.priority_id]
  );

  const statusLabel = useMemo(() =>
    STATUS_OPTIONS.find(s => s.value === formData.status)?.label || 'Não informado',
    [formData.status]
  );

  const isClosed = formData.status === 'closed';

  /* ── Formatação de data ───────────────────────────────────────────── */
  const formatDate = value => {
    if (!value) return 'Não informado';
    const clean = typeof value === 'string' ? value.replace(' GMT', '') : value;
    const date  = new Date(clean);
    if (Number.isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const normalizeId = value => {
    if (value === '' || value === null || value === undefined) return '';
    return Number(value);
  };

  /* ── Fetch helpers ────────────────────────────────────────────────── */
  const requestJson = async url => {
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Erro ao consultar ${url}`);
    return res.json();
  };

  /* ── Carga inicial ────────────────────────────────────────────────── */
  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const [ticketData, userData, categoryData, priorityData, messageData] =
        await Promise.all([
          requestJson(`/tickets/${id}`),
          requestJson('/users/'),
          requestJson('/categories/'),
          requestJson('/priorities/'),
          requestJson(`/tickets/${id}/messages`)
        ]);

      const uData = Array.isArray(userData)     ? userData     : (userData?.data     || []);
      const cData = Array.isArray(categoryData) ? categoryData : (categoryData?.data || []);
      const pData = Array.isArray(priorityData) ? priorityData : (priorityData?.data || []);
      const mData = Array.isArray(messageData)  ? messageData  : (messageData?.data  || []);

      setUsers(uData);
      setCategories(cData);
      setPriorities(pData);
      setMessages(mData);

      const matchedCategory = cData.find(c => c.name === ticketData.category);
      const matchedPriority = pData.find(p => p.name === ticketData.priority);
      const matchedUser     = uData.find(u => u.name === ticketData.user);

      let backendStatus = (ticketData.status || 'open').toLowerCase();
      if (backendStatus === 'aberto')                               backendStatus = 'open';
      if (backendStatus === 'fechado')                              backendStatus = 'closed';
      if (backendStatus === 'em atendimento' || backendStatus === 'andamento') backendStatus = 'in_progress';

      setFormData({
        subject:     ticketData.subject    || '',
        status:      backendStatus,
        category_id: ticketData.category_id || matchedCategory?.id || '',
        priority_id: ticketData.priority_id || matchedPriority?.id || '',
        user_id:     ticketData.user_id     || matchedUser?.id     || '',
        creation:    ticketData.creation   || '',
        sla:         ticketData.sla        || ''
      });

    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar os dados do chamado.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Recarrega somente as mensagens ───────────────────────────────── */
  const loadMessages = async () => {
    try {
      const data = await requestJson(`/tickets/${id}/messages`);
      setMessages(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      console.error(err);
      setError('Não foi possível atualizar o histórico de atividades.');
    }
  };

  useEffect(() => { loadTicketData(); }, [id]);

  /* ── Handlers de formulário ───────────────────────────────────────── */
  const handleFieldChange = (field, value) => {
    setSuccessMessage('');
    setError('');
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const buildPayload = () => ({
    subject:     formData.subject,
    status:      formData.status,
    category_id: formData.category_id === '' ? null : Number(formData.category_id),
    priority_id: formData.priority_id === '' ? null : Number(formData.priority_id),
    user_id:     formData.user_id     === '' ? null : Number(formData.user_id),
    creation:    formData.creation || null,
    sla:         formData.sla      || null
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const res = await apiFetch(`/tickets/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildPayload())
      });

      if (!res.ok) throw new Error('Erro de validação pelo servidor');
      setSuccessMessage('Alterações salvas com sucesso.');
    } catch (err) {
      console.error(err);
      setError('Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Confirma a exclusão definitiva deste chamado?')) return;
    try {
      setDeleting(true);
      setError('');
      const res = await apiFetch(`/tickets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir chamado');
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Não foi possível excluir o chamado.');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Envio de mensagem ────────────────────────────────────────────── */
  const handleSendMessage = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed) {
      setError('Digite uma mensagem antes de enviar.');
      return;
    }

    try {
      setSendingMessage(true);
      setError('');
      setSuccessMessage('');

      const res = await apiFetch(`/tickets/${id}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // O backend extrai o autor do JWT — não precisamos enviar signature aqui
        body: JSON.stringify({ message: trimmed })
      });

      if (!res.ok) throw new Error('Erro ao registrar mensagem');

      setNewMessage('');
      setSuccessMessage('Mensagem registrada com sucesso.');

      // Recarrega para obter a mensagem já com author_name resolvido pelo JOIN
      await loadMessages();

    } catch (err) {
      console.error(err);
      setError('Não foi possível registrar a mensagem.');
    } finally {
      setSendingMessage(false);
    }
  };

  /* ── Helpers de exibição das mensagens ───────────────────────────── */

  // Prioriza author_name (campo retornado pelo JOIN no backend)
  const getMessageAuthor = msg =>
    msg.author_name  ||
    msg.user_name    ||
    msg.author       ||
    msg.user?.name   ||
    'Sistema';

  const getMessageDate = msg =>
    msg.creation   ||
    msg.created_at ||
    msg.date       ||
    msg.updated_at ||
    '';

  const getMessageText = msg =>
    msg.message     ||
    msg.content     ||
    msg.text        ||
    msg.description ||
    '';

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="ticket-details-container">
        <div className="loading-state">
          <RefreshCw className="loading-icon" size={28} />
          <h2>Carregando chamado</h2>
          <p>Estamos buscando as informações do chamado.</p>
        </div>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="ticket-details-container">

      {/* HEADER */}
      <header className="page-header">
        <button type="button" onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={20} /> Retornar
        </button>

        <div className="header-title">
          <span className="header-eyebrow">Detalhes do chamado</span>
          <h1>Chamado #{id} — {formData.subject}</h1>
          <span className={`badge-status-top status-${formData.status}`}>
            {statusLabel}
          </span>
        </div>

        <div className="header-actions">
          <button
            type="button"
            onClick={handleDelete}
            className="btn-delete"
            disabled={deleting}
          >
            <Trash2 size={18} />
            {deleting ? 'Excluindo...' : 'Remover'}
          </button>
        </div>
      </header>

      {/* FEEDBACK */}
      {error && (
        <div className="feedback-message feedback-error">
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="feedback-message feedback-success">
          <Info size={18} /><span>{successMessage}</span>
        </div>
      )}

      {/* SUMÁRIO */}
      <section className="ticket-summary">
        <div className="summary-card">
          <span className="summary-label">Solicitante</span>
          <strong>{selectedUser?.name || 'Não informado'}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">Categoria</span>
          <strong>{selectedCategory?.name || 'Não informado'}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">Prioridade</span>
          <strong>{selectedPriority?.name || 'Não informado'}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">SLA</span>
          <strong>{formatDate(formData.sla)}</strong>
        </div>
      </section>

      {/* GRID PRINCIPAL */}
      <div className="details-grid">
        <main className="main-content">

          {/* DESCRIÇÃO */}
          <section className="static-card">
            <label className="section-label">
              <Info size={16} /> Descrição do chamado
            </label>
            <div className="subject-text-view">
              {formData.subject || 'Nenhum assunto ou descrição fornecida.'}
            </div>
          </section>

          {/* MENSAGENS */}
          <section className="messages-section">
            <div className="messages-header">
              <h3 className="messages-title">
                <MessageSquare size={18} />
                Registro de atividades
                <span>{messages.length}</span>
              </h3>
              <button type="button" className="btn-refresh" onClick={loadMessages}>
                <RefreshCw size={16} /> Atualizar
              </button>
            </div>

            {/* COMPOSER */}
            {!isClosed ? (
              <div className="message-composer">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Registre uma nova observação sobre este chamado..."
                  rows={4}
                />
                <div className="message-composer-footer">
                  <span>{newMessage.length} caracteres</span>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    className="btn-send-message"
                    disabled={sendingMessage}
                  >
                    <Send size={17} />
                    {sendingMessage ? 'Enviando...' : 'Registrar mensagem'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="closed-warning">
                <Info size={17} />
                <span>Este chamado está fechado. Reabra-o para registrar novas atividades.</span>
              </div>
            )}

            {/* LISTA DE MENSAGENS */}
            <div className="messages-list">
              {messages.length === 0 ? (
                <p className="no-messages">Nenhum registro de atividade encontrado.</p>
              ) : (
                /* Exibe em ordem cronológica crescente (mais antigas primeiro) */
                [...messages]
                  .sort((a, b) => {
                    const da = new Date((a.creation || a.created_at || '').replace(' GMT', ''));
                    const db = new Date((b.creation || b.created_at || '').replace(' GMT', ''));
                    return da - db;
                  })
                  .map((msg, index) => {
                    const author = getMessageAuthor(msg);
                    const color  = avatarColor(author);

                    return (
                      <article className="message-item" key={msg.id || index}>
                        {/* Avatar com cor baseada no nome do autor */}
                        <div
                          className="message-avatar"
                          style={{ backgroundColor: color }}
                          title={author}
                        >
                          {author.charAt(0).toUpperCase()}
                        </div>

                        <div className="message-content">
                          <div className="message-meta">
                            <strong>{author}</strong>
                            <span>{formatDate(getMessageDate(msg))}</span>
                          </div>
                          <p>{getMessageText(msg) || 'Mensagem sem conteúdo.'}</p>
                        </div>
                      </article>
                    );
                  })
              )}
            </div>
          </section>

          {/* ANEXOS */}
          <TicketAnexos ticketId={Number(id)} ticketFechado={isClosed} />

        </main>

        {/* SIDEBAR */}
        <aside className="sidebar-info">
          <div className="info-group primary-action">
            <button type="button" onClick={handleSave} className="btn-save" disabled={saving}>
              <Save size={20} />
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>

          <div className="info-group">
            <label><User size={16} /> Solicitante</label>
            <select
              value={formData.user_id}
              onChange={e => handleFieldChange('user_id', normalizeId(e.target.value))}
            >
              <option value="">Selecionar...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="info-group">
            <label><Clock size={16} /> Status</label>
            <select
              value={formData.status}
              onChange={e => handleFieldChange('status', e.target.value)}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="info-group">
            <label><AlertCircle size={16} /> Prioridade</label>
            <select
              value={formData.priority_id}
              onChange={e => handleFieldChange('priority_id', normalizeId(e.target.value))}
            >
              <option value="">Selecionar...</option>
              {priorities.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="info-group">
            <label><Tag size={16} /> Categoria</label>
            <select
              value={formData.category_id}
              onChange={e => handleFieldChange('category_id', normalizeId(e.target.value))}
            >
              <option value="">Selecionar...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="info-footer">
            <div className="info-static-item">
              <Calendar size={14} />
              <div>
                <span>Data de abertura</span>
                <strong>{formatDate(formData.creation)}</strong>
              </div>
            </div>
            <div className="info-static-item danger">
              <Clock size={14} />
              <div>
                <span>Prazo de resolução</span>
                <strong>{formatDate(formData.sla)}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TicketDetails;
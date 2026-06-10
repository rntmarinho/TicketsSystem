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
  RefreshCw,
  GitMerge,
  Search,
  X
} from 'lucide-react';

import TicketAnexos from './TicketAnexos';
import { apiFetch } from '../services/api';
import './styles/TicketDetails.css';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em atendimento' },
  { value: 'pending', label: 'Pendente' },
  { value: 'closed', label: 'Fechado' }
];

const emptyFormData = {
  subject: '',
  description: '',
  status: 'open',
  category_id: '',
  priority_id: '',
  user_id: '',
  creation: '',
  sla: ''
};

const avatarColor = name => {
  const palette = [
    '#2563eb',
    '#16a34a',
    '#dc2626',
    '#d97706',
    '#7c3aed',
    '#0891b2',
    '#be185d',
    '#059669'
  ];

  let hash = 0;

  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return palette[Math.abs(hash) % palette.length];
};

const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [messages, setMessages] = useState([]);

  const [newMessage, setNewMessage] = useState('');
  const [formData, setFormData] = useState(emptyFormData);

  // Merge
  const [mergeOpen, setMergeOpen] = useState(false);
  const [allTickets, setAllTickets] = useState([]);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeTarget, setMergeTarget] = useState(null);
  const [merging, setMerging] = useState(false);

  const selectedUser = useMemo(
    () => users.find(u => Number(u.id) === Number(formData.user_id)),
    [users, formData.user_id]
  );

  const selectedCategory = useMemo(
    () => categories.find(c => Number(c.id) === Number(formData.category_id)),
    [categories, formData.category_id]
  );

  const selectedPriority = useMemo(
    () => priorities.find(p => Number(p.id) === Number(formData.priority_id)),
    [priorities, formData.priority_id]
  );

  const statusLabel = useMemo(
    () =>
      STATUS_OPTIONS.find(s => s.value === formData.status)?.label ||
      'Não informado',
    [formData.status]
  );

  const isClosed = formData.status === 'closed';

  const formatDate = value => {
    if (!value) return 'Não informado';

    const clean =
      typeof value === 'string'
        ? value.replace(' GMT', '')
        : value;

    const date = new Date(clean);

    if (Number.isNaN(date.getTime())) {
      return 'Data inválida';
    }

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const normalizeId = value => {
    if (value === '' || value === null || value === undefined) {
      return '';
    }

    return Number(value);
  };

  const requestJson = async url => {
    const response = await apiFetch(url);

    if (!response.ok) {
      throw new Error(`Erro ao consultar ${url}`);
    }

    return response.json();
  };

  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const [
        ticketData,
        userData,
        categoryData,
        priorityData,
        messageData
      ] = await Promise.all([
        requestJson(`/tickets/${id}`),
        requestJson('/users/'),
        requestJson('/categories/'),
        requestJson('/priorities/'),
        requestJson(`/tickets/${id}/messages`)
      ]);

      const usersData = Array.isArray(userData)
        ? userData
        : userData?.data || [];

      const categoriesData = Array.isArray(categoryData)
        ? categoryData
        : categoryData?.data || [];

      const prioritiesData = Array.isArray(priorityData)
        ? priorityData
        : priorityData?.data || [];

      const messagesData = Array.isArray(messageData)
        ? messageData
        : messageData?.data || [];

      setUsers(usersData);
      setCategories(categoriesData);
      setPriorities(prioritiesData);
      setMessages(messagesData);

      const matchedCategory = categoriesData.find(
        c => c.name === ticketData.category
      );

      const matchedPriority = prioritiesData.find(
        p => p.name === ticketData.priority
      );

      const matchedUser = usersData.find(
        u => u.name === ticketData.user
      );

      let backendStatus = (
        ticketData.status || 'open'
      ).toLowerCase();

      if (backendStatus === 'aberto') {
        backendStatus = 'open';
      }

      if (backendStatus === 'fechado') {
        backendStatus = 'closed';
      }

      if (
        backendStatus === 'em atendimento' ||
        backendStatus === 'andamento'
      ) {
        backendStatus = 'in_progress';
      }

      setFormData({
        subject: ticketData.subject || '',
        description: ticketData.description || '',
        status: backendStatus,
        category_id:
          ticketData.category_id ||
          matchedCategory?.id ||
          '',
        priority_id:
          ticketData.priority_id ||
          matchedPriority?.id ||
          '',
        user_id:
          ticketData.user_id ||
          matchedUser?.id ||
          '',
        creation: ticketData.creation || '',
        sla: ticketData.sla || ''
      });
    } catch (err) {
      console.error(err);
      setError(
        'Não foi possível carregar os dados do chamado.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await requestJson(
        `/tickets/${id}/messages`
      );

      setMessages(
        Array.isArray(data)
          ? data
          : data?.data || []
      );
    } catch (err) {
      console.error(err);

      setError(
        'Não foi possível atualizar o histórico.'
      );
    }
  };

  useEffect(() => {
    loadTicketData();
  }, [id]);

  const handleFieldChange = (field, value) => {
    setSuccessMessage('');
    setError('');

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const buildPayload = () => ({
    subject: formData.subject,
    description: formData.description,
    status: formData.status,
    category_id:
      formData.category_id === ''
        ? null
        : Number(formData.category_id),
    priority_id:
      formData.priority_id === ''
        ? null
        : Number(formData.priority_id),
    user_id:
      formData.user_id === ''
        ? null
        : Number(formData.user_id),
    creation: formData.creation || null,
    sla: formData.sla || null
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const response = await apiFetch(
        `/tickets/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(buildPayload())
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao salvar');
      }

      setSuccessMessage(
        'Alterações salvas com sucesso.'
      );
    } catch (err) {
      console.error(err);

      setError(
        'Não foi possível salvar as alterações.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Confirma a exclusão definitiva deste chamado?'
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError('');

      const response = await apiFetch(
        `/tickets/${id}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao excluir');
      }

      navigate('/');
    } catch (err) {
      console.error(err);

      setError(
        'Não foi possível excluir o chamado.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmed = newMessage.trim();

    if (!trimmed) {
      setError(
        'Digite uma mensagem antes de enviar.'
      );

      return;
    }

    try {
      setSendingMessage(true);
      setError('');
      setSuccessMessage('');

      const response = await apiFetch(
        `/tickets/${id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: trimmed
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          'Erro ao registrar mensagem'
        );
      }

      setNewMessage('');

      setSuccessMessage(
        'Mensagem registrada com sucesso.'
      );

      await loadMessages();
    } catch (err) {
      console.error(err);

      setError(
        'Não foi possível registrar a mensagem.'
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const openMergeModal = async () => {
    try {
      const data = await requestJson('/tickets/');

      const list = Array.isArray(data)
        ? data
        : data?.data || [];

      setAllTickets(
        list.filter(
          ticket => String(ticket.id) !== String(id)
        )
      );

      setMergeSearch('');
      setMergeTarget(null);
      setMergeOpen(true);
    } catch (err) {
      console.error(err);

      setError(
        'Não foi possível carregar os chamados.'
      );
    }
  };

  const handleMerge = async () => {
    if (!mergeTarget) return;

    const confirmed = window.confirm(
      `Confirma a fusão do Chamado #${mergeTarget.id} neste chamado?\n\n` +
      `O chamado #${mergeTarget.id} será excluído.`
    );

    if (!confirmed) return;

    try {
      setMerging(true);
      setError('');

      const response = await apiFetch(
        `/tickets/${id}/merge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            merge_ticket_id: mergeTarget.id
          })
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.message || 'Erro ao fundir'
        );
      }

      setMergeOpen(false);
      setMergeTarget(null);

      setSuccessMessage(json.message);

      await loadMessages();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        'Não foi possível fundir os chamados.'
      );
    } finally {
      setMerging(false);
    }
  };

  const filteredMergeTickets =
    allTickets.filter(ticket => {
      const query = mergeSearch.toLowerCase();

      return (
        String(ticket.id).includes(query) ||
        (ticket.subject || '')
          .toLowerCase()
          .includes(query) ||
        (ticket.user || '')
          .toLowerCase()
          .includes(query)
      );
    });

  const getMessageAuthor = message =>
    message.author_name ||
    message.user_name ||
    message.author ||
    message.user?.name ||
    'Sistema';

  const getMessageDate = message =>
    message.creation ||
    message.created_at ||
    message.date ||
    message.updated_at ||
    '';

  const getMessageText = message =>
    message.message ||
    message.content ||
    message.text ||
    message.description ||
    '';

  if (loading) {
    return (
      <div className="ticket-details-container">
        <div className="loading-state">
          <RefreshCw
            className="loading-icon"
            size={30}
          />

          <h2>Carregando chamado</h2>

          <p>
            Aguarde enquanto buscamos as
            informações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-details-container">

      <header className="page-header">

        <button
          type="button"
          className="btn-back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={18} />
          Voltar
        </button>

        <div className="header-title">
          <span className="header-eyebrow">
            TicketSystem
          </span>

          <h1>
            Chamado #{id}
          </h1>

          <p>
            {formData.subject}
          </p>

          <span
            className={`badge-status-top status-${formData.status}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="header-actions">

          <button
            type="button"
            className="btn-delete"
            disabled={deleting}
            onClick={handleDelete}
          >
            <Trash2 size={16} />

            {deleting
              ? 'Excluindo...'
              : 'Excluir'}
          </button>

        </div>

      </header>

      {error && (
        <div className="feedback-message feedback-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="feedback-message feedback-success">
          <Info size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <section className="ticket-summary">

        <div className="summary-card">
          <span className="summary-label">
            Solicitante
          </span>

          <strong>
            {selectedUser?.name ||
              'Não informado'}
          </strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">
            Categoria
          </span>

          <strong>
            {selectedCategory?.name ||
              'Não informado'}
          </strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">
            Prioridade
          </span>

          <strong>
            {selectedPriority?.name ||
              'Não informado'}
          </strong>
        </div>

        <div className="summary-card">
          <span className="summary-label">
            SLA
          </span>

          <strong>
            {formatDate(formData.sla)}
          </strong>
        </div>

      </section>

      <div className="details-grid">

        <main className="main-content">

          <section className="static-card">

            <label className="section-label">
              <Info size={16} />
              Descrição
            </label>

            <div className="subject-text-view">
              {formData.description ||
                'Nenhuma descrição fornecida.'}
            </div>

          </section>

          <section className="messages-section">

            <div className="messages-header">

              <h3 className="messages-title">
                <MessageSquare size={18} />
                Atividades
                <span>{messages.length}</span>
              </h3>

              <button
                type="button"
                className="btn-refresh"
                onClick={loadMessages}
              >
                <RefreshCw size={16} />
                Atualizar
              </button>

            </div>

            {!isClosed ? (
              <div className="message-composer">

                <textarea
                  rows={4}
                  value={newMessage}
                  placeholder="Digite uma nova mensagem..."
                  onChange={e =>
                    setNewMessage(e.target.value)
                  }
                />

                <div className="message-composer-footer">

                  <span>
                    {newMessage.length} caracteres
                  </span>

                  <button
                    type="button"
                    className="btn-send-message"
                    disabled={sendingMessage}
                    onClick={handleSendMessage}
                  >
                    <Send size={16} />

                    {sendingMessage
                      ? 'Enviando...'
                      : 'Enviar'}
                  </button>

                </div>

              </div>
            ) : (
              <div className="closed-warning">
                <Info size={16} />
                <span>
                  Este chamado está fechado.
                </span>
              </div>
            )}

            <div className="messages-list">

              {messages.length === 0 ? (
                <p className="no-messages">
                  Nenhuma mensagem registrada.
                </p>
              ) : (
                [...messages]
                  .sort((a, b) => {
                    const da = new Date(
                      (
                        a.creation ||
                        a.created_at ||
                        ''
                      ).replace(' GMT', '')
                    );

                    const db = new Date(
                      (
                        b.creation ||
                        b.created_at ||
                        ''
                      ).replace(' GMT', '')
                    );

                    return da - db;
                  })
                  .map((message, index) => {
                    const author =
                      getMessageAuthor(message);

                    const color =
                      avatarColor(author);

                    return (
                      <article
                        className="message-item"
                        key={message.id || index}
                      >

                        <div
                          className="message-avatar"
                          style={{
                            backgroundColor: color
                          }}
                        >
                          {author
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="message-content">

                          <div className="message-meta">

                            <strong>
                              {author}
                            </strong>

                            <span>
                              {formatDate(
                                getMessageDate(
                                  message
                                )
                              )}
                            </span>

                          </div>

                          <p>
                            {getMessageText(
                              message
                            )}
                          </p>

                        </div>

                      </article>
                    );
                  })
              )}

            </div>

          </section>

          <TicketAnexos
            ticketId={Number(id)}
            ticketFechado={isClosed}
          />

        </main>

        <aside className="sidebar-info">

          <div className="info-group primary-action">

            <button
              type="button"
              className="btn-save"
              disabled={saving}
              onClick={handleSave}
            >
              <Save size={18} />

              {saving
                ? 'Salvando...'
                : 'Salvar alterações'}
            </button>

            <button
              type="button"
              className="btn-merge"
              onClick={openMergeModal}
            >
              <GitMerge size={18} />
              Fundir chamado
            </button>

          </div>

          <div className="info-group">

            <label>
              <User size={16} />
              Solicitante
            </label>

            <select
              value={formData.user_id}
              onChange={e =>
                handleFieldChange(
                  'user_id',
                  normalizeId(e.target.value)
                )
              }
            >
              <option value="">
                Selecionar...
              </option>

              {users.map(user => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.name}
                </option>
              ))}
            </select>

          </div>

          <div className="info-group">

            <label>
              <Clock size={16} />
              Status
            </label>

            <select
              value={formData.status}
              onChange={e =>
                handleFieldChange(
                  'status',
                  e.target.value
                )
              }
            >
              {STATUS_OPTIONS.map(status => (
                <option
                  key={status.value}
                  value={status.value}
                >
                  {status.label}
                </option>
              ))}
            </select>

          </div>

          <div className="info-group">

            <label>
              <AlertCircle size={16} />
              Prioridade
            </label>

            <select
              value={formData.priority_id}
              onChange={e =>
                handleFieldChange(
                  'priority_id',
                  normalizeId(e.target.value)
                )
              }
            >
              <option value="">
                Selecionar...
              </option>

              {priorities.map(priority => (
                <option
                  key={priority.id}
                  value={priority.id}
                >
                  {priority.name}
                </option>
              ))}
            </select>

          </div>

          <div className="info-group">

            <label>
              <Tag size={16} />
              Categoria
            </label>

            <select
              value={formData.category_id}
              onChange={e =>
                handleFieldChange(
                  'category_id',
                  normalizeId(e.target.value)
                )
              }
            >
              <option value="">
                Selecionar...
              </option>

              {categories.map(category => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>

          </div>

          <div className="info-footer">

            <div className="info-static-item">

              <Calendar size={14} />

              <div>
                <span>
                  Data de abertura
                </span>

                <strong>
                  {formatDate(
                    formData.creation
                  )}
                </strong>
              </div>

            </div>

            <div className="info-static-item danger">

              <Clock size={14} />

              <div>
                <span>
                  Prazo SLA
                </span>

                <strong>
                  {formatDate(formData.sla)}
                </strong>
              </div>

            </div>

          </div>

        </aside>

      </div>

      {mergeOpen && (
        <div
          className="modal-overlay"
          onClick={e => {
            if (
              e.target === e.currentTarget
            ) {
              setMergeOpen(false);
            }
          }}
        >

          <div className="merge-modal">

            <div className="merge-modal-header">

              <div>

                <h2>
                  <GitMerge size={20} />
                  Fundir Chamado
                </h2>

                <p>
                  Escolha um chamado para
                  unir ao atual.
                </p>

              </div>

              <button
                className="btn-modal-close"
                onClick={() =>
                  setMergeOpen(false)
                }
              >
                <X size={20} />
              </button>

            </div>

            <div className="merge-search-wrap">

              <Search
                size={16}
                className="merge-search-icon"
              />

              <input
                type="text"
                placeholder="Buscar chamado..."
                value={mergeSearch}
                onChange={e =>
                  setMergeSearch(
                    e.target.value
                  )
                }
              />

            </div>

            <div className="merge-list">

              {filteredMergeTickets.length === 0 ? (
                <p className="merge-empty">
                  Nenhum chamado encontrado.
                </p>
              ) : (
                filteredMergeTickets.map(
                  ticket => (
                    <button
                      key={ticket.id}
                      className={`merge-item ${
                        mergeTarget?.id ===
                        ticket.id
                          ? 'merge-item--selected'
                          : ''
                      }`}
                      onClick={() =>
                        setMergeTarget(ticket)
                      }
                    >

                      <span className="merge-item-id">
                        #{ticket.id}
                      </span>

                      <span className="merge-item-subject">
                        {ticket.subject}
                      </span>

                      <span className="merge-item-meta">
                        {ticket.user || '—'} ·{' '}
                        {ticket.status}
                      </span>

                    </button>
                  )
                )
              )}

            </div>

            {mergeTarget && (
              <div className="merge-confirm-bar">

                <span>
                  Fundir chamado{' '}
                  <strong>
                    #{mergeTarget.id}
                  </strong>
                </span>

                <button
                  className="btn-merge-confirm"
                  disabled={merging}
                  onClick={handleMerge}
                >
                  <GitMerge size={16} />

                  {merging
                    ? 'Fundindo...'
                    : 'Confirmar'}
                </button>

              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};

export default TicketDetails;
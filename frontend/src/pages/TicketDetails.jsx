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
  status: 'open',
  category_id: '',
  priority_id: '',
  user_id: '',
  creation: '',
  sla: ''
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

  const selectedUser = useMemo(() => {
    return users.find(user => Number(user.id) === Number(formData.user_id));
  }, [users, formData.user_id]);

  const selectedCategory = useMemo(() => {
    return categories.find(category => Number(category.id) === Number(formData.category_id));
  }, [categories, formData.category_id]);

  const selectedPriority = useMemo(() => {
    return priorities.find(priority => Number(priority.id) === Number(formData.priority_id));
  }, [priorities, formData.priority_id]);

  const statusLabel = useMemo(() => {
    return STATUS_OPTIONS.find(status => status.value === formData.status)?.label || 'Não informado';
  }, [formData.status]);

  const isClosed = formData.status === 'closed';

  const formatDate = value => {
    if (!value) return 'Não informado';

    const date = new Date(value);

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
    if (value === '' || value === null || value === undefined) return '';
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

      // Certifica-se de que estamos trabalhando com arrays válidos
      const uData = Array.isArray(userData) ? userData : (userData?.data || []);
      const cData = Array.isArray(categoryData) ? categoryData : (categoryData?.data || []);
      const pData = Array.isArray(priorityData) ? priorityData : (priorityData?.data || []);
      const mData = Array.isArray(messageData) ? messageData : (messageData?.data || []);

      setUsers(uData);
      setCategories(cData);
      setPriorities(pData);
      setMessages(mData);

      // O Backend retorna os 'nomes' das chaves estrangeiras. Procuramos seus devidos IDs.
      const matchedCategory = cData.find(c => c.name === ticketData.category);
      const matchedPriority = pData.find(p => p.name === ticketData.priority);
      const matchedUser = uData.find(u => u.name === ticketData.user);

      // Normalização amigável de status para contemplar possíveis traduções retornadas pela API
      let backendStatus = (ticketData.status || 'open').toLowerCase();
      if (backendStatus === 'aberto') backendStatus = 'open';
      if (backendStatus === 'fechado') backendStatus = 'closed';
      if (backendStatus === 'em atendimento' || backendStatus === 'andamento') backendStatus = 'in_progress';

      setFormData({
        subject: ticketData.subject || '',
        status: backendStatus,
        category_id: ticketData.category_id || matchedCategory?.id || '',
        priority_id: ticketData.priority_id || matchedPriority?.id || '',
        user_id: ticketData.user_id || matchedUser?.id || '',
        creation: ticketData.creation || '',
        sla: ticketData.sla || ''
      });

    } catch (err) {
      console.error('Erro ao carregar dados do chamado:', err);
      setError('Não foi possível carregar os dados do chamado. Verifique a conexão ou tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const messageData = await requestJson(`/tickets/${id}/messages`);
      setMessages(Array.isArray(messageData) ? messageData : (messageData?.data || []));
    } catch (err) {
      console.error('Erro ao atualizar histórico:', err);
      setError('Não foi possível atualizar o histórico de atividades.');
    }
  };

  useEffect(() => {
    loadTicketData();
  }, [id]);

  const handleFieldChange = (field, value) => {
    setSuccessMessage('');
    setError('');

    setFormData(previous => ({
      ...previous,
      [field]: value
    }));
  };

  const buildPayload = () => {
    return {
      subject: formData.subject,
      status: formData.status,
      category_id: formData.category_id === '' ? null : Number(formData.category_id),
      priority_id: formData.priority_id === '' ? null : Number(formData.priority_id),
      user_id: formData.user_id === '' ? null : Number(formData.user_id),
      creation: formData.creation || null,
      sla: formData.sla || null
    };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const response = await apiFetch(`/tickets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildPayload())
      });

      if (!response.ok) {
        throw new Error('Erro de validação pelo servidor');
      }

      setSuccessMessage('Alterações salvas com sucesso.');
    } catch (err) {
      console.error('Erro ao salvar chamado:', err);
      setError('Não foi possível salvar as alterações. Revise os campos e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('Confirma a exclusão definitiva deste chamado?');

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError('');
      setSuccessMessage('');

      const response = await apiFetch(`/tickets/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Falha ao excluir chamado');
      }

      navigate('/');
    } catch (err) {
      console.error('Erro ao excluir chamado:', err);
      setError('Não foi possível excluir o chamado.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();

    if (!trimmedMessage) {
      setError('Digite uma mensagem antes de enviar.');
      return;
    }

    try {
      setSendingMessage(true);
      setError('');
      setSuccessMessage('');

      const response = await apiFetch(`/tickets/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: trimmedMessage
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao registrar mensagem');
      }

      let createdMessage = null;

      try {
        createdMessage = await response.json();
      } catch {
        createdMessage = null;
      }

      if (createdMessage) {
        setMessages(previous => [createdMessage, ...previous]);
      } else {
        await loadMessages();
      }

      setNewMessage('');
      setSuccessMessage('Mensagem registrada com sucesso.');
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setError('Não foi possível registrar a mensagem. Verifique se a rota de mensagens está ativa na API.');
    } finally {
      setSendingMessage(false);
    }
  };

  const getMessageAuthor = message => {
    return (
      message.user_name ||
      message.author_name ||
      message.author ||
      message.user?.name ||
      'Sistema'
    );
  };

  const getMessageDate = message => {
    return (
      message.created_at ||
      message.creation ||
      message.date ||
      message.updated_at ||
      ''
    );
  };

  const getMessageText = message => {
    return (
      message.message ||
      message.content ||
      message.text ||
      message.description ||
      ''
    );
  };

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

  return (
    <div className="ticket-details-container">
      <header className="page-header">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn-back"
        >
          <ArrowLeft size={20} />
          Retornar
        </button>

        <div className="header-title">
          <span className="header-eyebrow">Detalhes do chamado</span>
          <h1> Chamado #{id} - {formData.subject}</h1>
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
            title="Excluir chamado"
          >
            <Trash2 size={18} />
            {deleting ? 'Excluindo...' : 'Remover'}
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

      <div className="details-grid">
        <main className="main-content">
         <section className="static-card">
            <label className="section-label">
              <Info size={16} />
              Descrição do chamado
            </label>

            <div className="subject-text-view">
              {formData.subject || 'Nenhum assunto ou descrição fornecida.'}
            </div>
          </section>

          <section className="messages-section">
            <div className="messages-header">
              <h3 className="messages-title">
                <MessageSquare size={18} />
                Registro de atividades
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

            {!isClosed && (
              <div className="message-composer">
                <textarea
                  value={newMessage}
                  onChange={event => setNewMessage(event.target.value)}
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
            )}

            {isClosed && (
              <div className="closed-warning">
                <Info size={17} />
                <span>Este chamado está fechado. Reabra o chamado para registrar novas atividades.</span>
              </div>
            )}

            <div className="messages-list">
              {messages.length === 0 && (
                <p className="no-messages">Nenhum registro de atividade encontrado.</p>
              )}

              {messages.map((message, index) => (
                <article className="message-item" key={message.id || index}>
                  <div className="message-avatar">
                    {getMessageAuthor(message).charAt(0).toUpperCase()}
                  </div>

                  <div className="message-content">
                    <div className="message-meta">
                      <strong>{getMessageAuthor(message)}</strong>
                      <span>{formatDate(getMessageDate(message))}</span>
                    </div>

                    <p>{getMessageText(message) || 'Mensagem sem conteúdo.'}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="sidebar-info">
          <div className="info-group primary-action">
            <button
              type="button"
              onClick={handleSave}
              className="btn-save"
              disabled={saving}
            >
              <Save size={20} />
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>

          <div className="info-group">
            <label>
              <User size={16} />
              Solicitante
            </label>

            <select
              value={formData.user_id}
              onChange={event => handleFieldChange('user_id', normalizeId(event.target.value))}
            >
              <option value="">Selecionar...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
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
              onChange={event => handleFieldChange('status', event.target.value)}
            >
              {STATUS_OPTIONS.map(status => (
                <option key={status.value} value={status.value}>
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
              onChange={event => handleFieldChange('priority_id', normalizeId(event.target.value))}
            >
              <option value="">Selecionar...</option>
              {priorities.map(priority => (
                <option key={priority.id} value={priority.id}>
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
              onChange={event => handleFieldChange('category_id', normalizeId(event.target.value))}
            >
              <option value="">Selecionar...</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
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
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Calendar, User, Info, Tag,
  AlertCircle, Clock, Trash2, GitMerge, Send, MessageSquare, X
} from 'lucide-react';
import { apiFetch } from '../services/api'; // Importação do apiFetch adicionada
import './styles/TicketDetails.css';

/* ─── componente de modal de fusão ─────────────────────────────────────── */
const MergeModal = ({ currentId, tickets, onConfirm, onClose }) => {
  const [selectedId, setSelectedId] = useState('');
  const others = tickets.filter(t => t.id !== currentId);

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>

        <h2><GitMerge size={20} /> Fundir Chamado</h2>
        <p className="modal-desc">
          Selecione o chamado <strong>mais novo</strong> para fundir dentro do
          chamado atual <strong>#{currentId}</strong>. Ele será convertido em
          mensagem e depois excluído.
        </p>

        <select
          className="modal-select"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">Selecione um chamado...</option>
          {others.map(t => (
            <option key={t.id} value={t.id}>
              #{t.id} — {t.assunto} [{t.status}]
            </option>
          ))}
        </select>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="btn-merge-confirm"
            disabled={!selectedId}
            onClick={() => onConfirm(Number(selectedId))}
          >
            <GitMerge size={16} /> Confirmar Fusão
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── componente de nova mensagem manual ───────────────────────────────── */
const NewMessageForm = ({ ticketId, currentUser, onMessageSent }) => {
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!texto.trim()) return;
    setSending(true);
    try {
      // Correção: apiFetch sem prefixo /api
      const res = await apiFetch(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autor: currentUser?.nome ?? 'Técnico', conteudo: texto }),
      });
      if (res.ok) {
        setTexto('');
        onMessageSent();
      } else {
        alert('Erro ao enviar mensagem.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="new-message-form">
      <textarea
        placeholder="Escreva uma atualização ou observação..."
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={3}
      />
      <button className="btn-send" onClick={handleSend} disabled={sending || !texto.trim()}>
        <Send size={16} /> {sending ? 'Enviando...' : 'Enviar'}
      </button>
    </div>
  );
};

/* ─── página principal ──────────────────────────────────────────────────── */
const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [messages, setMessages] = useState([]);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  const [formData, setFormData] = useState({
    assunto: '',
    descricao: '',
    prioridade: '',
    status: '',
    categoria: '',
    usuario_id: ''
  });

  useEffect(() => {
    // Correção: apiFetch com barra no final em rotas raiz e remoção do /api
    Promise.all([
      apiFetch(`/tickets/${id}`).then(r => r.json()),
      apiFetch('/users/').then(r => r.json()),
      apiFetch('/categories/').then(r => r.json()),
      apiFetch('/tickets/').then(r => r.json()),
      apiFetch(`/tickets/${id}/messages`).then(r => r.json()),
    ]).then(([ticketData, userData, categoryData, allData, msgData]) => {
      setFormData({ ...ticketData, categoria: ticketData.categoria });
      setUsers(userData);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setAllTickets(Array.isArray(allData) ? allData : []);
      setMessages(Array.isArray(msgData) ? msgData : []);
      setLoading(false);
    }).catch(err => {
      console.error('Erro ao carregar dados:', err);
      setLoading(false);
    });
  }, [id]);

  const reloadMessages = () => {
    // Correção: apiFetch sem prefixo /api
    apiFetch(`/tickets/${id}/messages`)
      .then(r => r.json())
      .then(data => setMessages(Array.isArray(data) ? data : []));
  };

  const handleSave = async () => {
    try {
      // Correção: apiFetch sem prefixo /api
      const res = await apiFetch(`/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        alert('Alterações salvas com sucesso!');
        navigate('/');
      } else {
        alert('Erro ao salvar no servidor.');
      }
    } catch {
      alert('Erro de conexão ao salvar alterações.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja excluir este chamado permanentemente?')) return;
    try {
      // Correção: apiFetch sem prefixo /api
      const res = await apiFetch(`/tickets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Chamado excluído com sucesso!');
        navigate('/');
      } else {
        alert('Erro ao excluir o chamado.');
      }
    } catch {
      alert('Erro de conexão com o servidor.');
    }
  };

  const handleMergeConfirm = async (filhoId) => {
    try {
      // Correção: apiFetch sem prefixo /api
      const res = await apiFetch(`/tickets/${id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filho_id: filhoId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowMergeModal(false);
        reloadMessages();
        setAllTickets(prev => prev.filter(t => t.id !== filhoId));
      } else {
        alert('Erro: ' + data.message);
      }
    } catch {
      alert('Erro de conexão com o servidor.');
    }
  };

  if (loading) return <div className="loading">Carregando informações...</div>;

  return (
    <div className="ticket-details-container">
      {showMergeModal && (
        <MergeModal
          currentId={Number(id)}
          tickets={allTickets}
          onConfirm={handleMergeConfirm}
          onClose={() => setShowMergeModal(false)}
        />
      )}

      <header className="page-header">
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={20} /> Voltar
        </button>

        <div className="header-title">
          <h1>Chamado #{id}</h1>
          <span className={`badge-status-top ${formData.status}`}>{formData.status}</span>
        </div>

        <div className="header-actions">
          <button
            className="btn-merge"
            onClick={() => setShowMergeModal(true)}
            title="Fundir outro chamado neste"
          >
            <GitMerge size={18} /> Fundir Chamado
          </button>
          <button onClick={handleDelete} className="btn-delete" title="Excluir permanentemente">
            <Trash2 size={18} /> Excluir
          </button>
        </div>
      </header>

      <div className="details-grid">
        <main className="main-content">
          <div className="static-card">
            <label className="section-label"><Info size={16} /> Detalhes do Chamado</label>
            <h2 className="static-subject">{formData.assunto}</h2>
            <div className="static-description">{formData.descricao}</div>
          </div>

          <div className="messages-section">
            <h3 className="messages-title">
              <MessageSquare size={18} /> Histórico ({messages.length})
            </h3>

            {messages.length === 0 && (
              <p className="no-messages">Nenhuma mensagem ainda.</p>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`message-bubble ${msg.autor === 'Sistema' ? 'system' : 'user'}`}
              >
                <div className="message-header">
                  <strong>{msg.autor}</strong>
                  {msg.origem_id && (
                    <span className="merge-badge">fusão do #{msg.origem_id}</span>
                  )}
                  <span className="message-time">
                    {new Date(msg.criado_em).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="message-body">
                  {msg.conteudo.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            ))}

            <NewMessageForm
              ticketId={id}
              currentUser={currentUser}
              onMessageSent={reloadMessages}
            />
          </div>
        </main>

        <aside className="sidebar-info">
          <div className="info-group">
            <button onClick={handleSave} className="btn-save">
              <Save size={20} /> Salvar Alterações
            </button>
          </div>

          <div className="info-group">
            <label><User size={16} /> Solicitante</label>
            <select
              value={formData.usuario_id}
              onChange={e => setFormData({ ...formData, usuario_id: e.target.value })}
            >
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.nome}</option>
              ))}
            </select>
          </div>

          <div className="info-group">
            <label><Clock size={16} /> Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="aberto">Aberto</option>
              <option value="em atendimento">Em Atendimento</option>
              <option value="fechado">Fechado</option>
            </select>
          </div>

          <div className="info-group">
            <label><AlertCircle size={16} /> Prioridade</label>
            <select
              value={formData.prioridade}
              onChange={e => setFormData({ ...formData, prioridade: e.target.value })}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          <div className="info-group">
            <label><Tag size={16} /> Categoria</label>
            <select
              value={formData.categoria}
              onChange={e => setFormData({ ...formData, categoria: e.target.value })}
            >
              <option value="">Selecione uma categoria...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>

          <div className="info-footer">
            <div className="info-static-item">
              <Calendar size={14} />
              <span>
                Aberto em:{' '}
                {formData.data_criacao
                  ? new Date(formData.data_criacao).toLocaleString('pt-BR')
                  : 'N/A'}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TicketDetails;
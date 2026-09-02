import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Video, Paperclip, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTeams, getStaff } from '../../services/gestao/teamService';
import {
  getTeamMessages, sendTeamMessage, startTeamCall, uploadTeamAttachment,
  getDirectMessages, sendDirectMessage, startDirectCall, uploadDirectAttachment,
} from '../../services/gestao/messageService';
import { getPresence } from '../../services/gestao/presenceService';
import { getDownloadUrl } from '../../services/gestao/attachmentService';
import './styles/Gestao.css';

const TEAM_POLL_MS = 3000;
const DIRECT_POLL_MS = 4000;
const PRESENCE_POLL_MS = 30000;

const CallBubble = ({ body }) => {
  const url = body.split(': ')[1];
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="gestao-btn-primary" style={{ display: 'inline-flex' }}>
      <Video size={14} /> Entrar na chamada
    </a>
  );
};

const MessageBubble = ({ msg, mine }) => (
  <div className={`gestao-chat-bubble ${mine ? 'mine' : ''}`}>
    {!mine && <div className="gestao-comment-author">{msg.sender?.name}</div>}
    {msg.is_call ? (
      <CallBubble body={msg.body} />
    ) : msg.attachment ? (
      <a href={getDownloadUrl(msg.attachment.id)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Paperclip size={13} /> {msg.attachment.file_name}
      </a>
    ) : (
      <div>{msg.body}</div>
    )}
    <div className="gestao-chat-time">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>
);

const GestaoChat = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(null); // { kind: 'team'|'direct', id }
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [online, setOnline] = useState({}); // user_id -> bool (presença via heartbeat)
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    getTeams().then((d) => setTeams(Array.isArray(d) ? d : []));
    getStaff().then((d) => setStaff(Array.isArray(d) ? d.filter((u) => u.id !== user?.id) : []));
  }, [user?.id]);

  useEffect(() => {
    const refresh = () => getPresence().then((d) => {
      if (!Array.isArray(d)) return;
      const map = {};
      d.forEach((p) => { map[p.user_id] = p.online; });
      setOnline(map);
    }).catch(() => {});
    refresh();
    const id = setInterval(refresh, PRESENCE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!selected) return;
    const data = selected.kind === 'team' ? await getTeamMessages(selected.id) : await getDirectMessages(selected.id);
    if (Array.isArray(data)) setMessages(data);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    load();
    const ms = selected.kind === 'team' ? TEAM_POLL_MS : DIRECT_POLL_MS;
    const id = setInterval(load, ms);
    return () => clearInterval(id);
  }, [selected, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !selected) return;
    if (selected.kind === 'team') await sendTeamMessage(selected.id, text.trim());
    else await sendDirectMessage(selected.id, text.trim());
    setText('');
    load();
  };

  const handleCall = async () => {
    if (!selected) return;
    const response = selected.kind === 'team' ? await startTeamCall(selected.id) : await startDirectCall(selected.id);
    if (response.jitsi_url) window.open(response.jitsi_url, '_blank', 'noopener,noreferrer');
    load();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const response = selected.kind === 'team' ? await uploadTeamAttachment(selected.id, file) : await uploadDirectAttachment(selected.id, file);
    if (response.success === false) alert(response.message || 'Erro ao enviar anexo.');
    e.target.value = '';
    load();
  };

  return (
    <div className="gestao-container gestao-chat-page">
      <header className="gestao-header">
        <h1><MessageSquare size={24} /> Chat</h1>
      </header>

      <div className="gestao-chat-layout">
        <aside className="gestao-chat-sidebar">
          <div className="gestao-section-title">Equipes</div>
          {teams.map((t) => (
            <button
              key={t.id} className={`gestao-chat-contact ${selected?.kind === 'team' && selected.id === t.id ? 'active' : ''}`}
              onClick={() => setSelected({ kind: 'team', id: t.id, label: t.name })}
            >
              {t.name}
            </button>
          ))}
          <div className="gestao-section-title">Pessoas</div>
          {staff.map((u) => (
            <button
              key={u.id} className={`gestao-chat-contact ${selected?.kind === 'direct' && selected.id === u.id ? 'active' : ''}`}
              onClick={() => setSelected({ kind: 'direct', id: u.id, label: u.name })}
            >
              <span className={`gestao-presence-dot${online[u.id] ? ' online' : ''}`} title={online[u.id] ? 'Online' : 'Offline'} />
              {u.name}
            </button>
          ))}
        </aside>

        <section className="gestao-chat-main">
          {!selected ? (
            <p className="gestao-empty">Escolha uma equipe ou pessoa pra conversar.</p>
          ) : (
            <>
              <div className="gestao-chat-header">
                <strong>{selected.label}</strong>
                <button className="gestao-btn-secondary" onClick={handleCall}><Video size={14} /> Chamar</button>
              </div>
              <div className="gestao-chat-messages">
                {messages.map((m) => (
                  <MessageBubble key={m.id} msg={m} mine={(m.sender?.id || m.sender_id) === user?.id} />
                ))}
                <div ref={bottomRef} />
              </div>
              <form className="gestao-chat-input" onSubmit={handleSend}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFile} />
                <button type="button" className="gestao-icon-btn" onClick={() => fileInputRef.current?.click()}><Paperclip size={16} /></button>
                <input placeholder="Mensagem..." value={text} onChange={(e) => setText(e.target.value)} />
                <button type="submit" className="gestao-btn-primary"><Send size={14} /></button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default GestaoChat;

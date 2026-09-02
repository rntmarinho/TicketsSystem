import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sendHeartbeat } from '../services/gestao/presenceService';
import { getIncomingCalls } from '../services/gestao/messageService';
import '../pages/gestao/styles/Gestao.css';

const HEARTBEAT_MS = 30000;
const CALL_POLL_MS = 5000;

const GESTAO_ROLES = ['ADMIN', 'DIRETOR', 'GESTOR_PROJETO', 'APROVADOR', 'COLABORADOR', 'VISUALIZADOR'];

/**
 * Componente global (montado em App.jsx, igual ao NotificationBell): manda
 * heartbeat de presença periodicamente e escuta chamada chegando via polling
 * — mesmo mecanismo "toca agora" do APPCNS original (mensagem dos últimos
 * 20s que começa com o prefixo de chamada), sem infraestrutura de push.
 */
const PresenceAndCalls = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState(null);
  const seenRef = useRef(new Set());
  const hasAccess = GESTAO_ROLES.includes(role);

  useEffect(() => {
    if (!hasAccess) return undefined;
    sendHeartbeat();
    const hbId = setInterval(sendHeartbeat, HEARTBEAT_MS);
    return () => clearInterval(hbId);
  }, [hasAccess]);

  useEffect(() => {
    if (!hasAccess) return undefined;
    const check = () => {
      getIncomingCalls().then((calls) => {
        if (!Array.isArray(calls)) return;
        const fresh = calls.find((c) => !seenRef.current.has(c.id));
        if (fresh) {
          seenRef.current.add(fresh.id);
          setIncoming(fresh);
        }
      }).catch(() => {});
    };
    check();
    const id = setInterval(check, CALL_POLL_MS);
    return () => clearInterval(id);
  }, [hasAccess]);

  if (!incoming) return null;

  const url = incoming.body?.split(': ')[1];

  return (
    <div className="gestao-incoming-call">
      <Video size={20} color="var(--accent)" />
      <div>
        <div><strong>{incoming.sender?.name}</strong> está te chamando</div>
      </div>
      <button
        className="gestao-btn-primary"
        onClick={() => {
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
          setIncoming(null);
          if (incoming.scope === 'team') navigate('/gestao/chat');
        }}
      >
        Atender
      </button>
      <button className="gestao-icon-btn" onClick={() => setIncoming(null)}><X size={16} /></button>
    </div>
  );
};

export default PresenceAndCalls;

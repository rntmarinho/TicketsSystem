import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { normalizeStatus } from '../constants/ticketStatus';
import './NotificationBell.css';

const LIMIAR_HORAS = 24; // "prestes a vencer" — fixo por enquanto
const INTERVALO_MS = 2 * 60 * 1000; // 2 minutos

const parseDate = (val) => {
  if (!val) return null;
  const clean = typeof val === 'string' ? val.replace(' GMT', '') : val;
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const lastSeenRef = useRef(null);

  const seenKey = user?.id ? `notif_activity_seen_${user.id}` : null;

  const getLastSeen = () => {
    if (lastSeenRef.current) return lastSeenRef.current;
    const stored = seenKey ? localStorage.getItem(seenKey) : null;
    const initial = stored ? new Date(stored) : new Date();
    // Primeira vez que o recurso roda pro usuário: marca "visto" a partir de
    // agora, pra não despejar todo o histórico como notificação nova.
    if (!stored && seenKey) localStorage.setItem(seenKey, initial.toISOString());
    lastSeenRef.current = initial;
    return initial;
  };

  const markSeen = () => {
    const agora = new Date();
    lastSeenRef.current = agora;
    if (seenKey) localStorage.setItem(seenKey, agora.toISOString());
    setActivity([]);
  };

  const isStaff = role === 'admin' || role === 'technician';

  const load = () => {
    apiFetch('/tickets/')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const agora = new Date();
        const limite = new Date(agora.getTime() + LIMIAR_HORAS * 60 * 60 * 1000);

        // Alerta de SLA é informação de operação da equipe — cliente não vê.
        if (isStaff) {
          const proximos = data
            .filter(t => normalizeStatus(t.status) !== 'closed')
            .map(t => ({ ...t, _sla: parseDate(t.sla) }))
            .filter(t => t._sla && t._sla <= limite)
            .map(t => ({ ...t, _vencido: t._sla < agora }))
            .sort((a, b) => a._sla - b._sla);

          setAlerts(proximos);
        }

        if (!seenKey) return;
        const lastSeen = getLastSeen();
        let novaAtividade = [];

        if (isStaff) {
          const novosChamados = data
            .map(t => ({ ...t, _quando: parseDate(t.creation) }))
            .filter(t => t._quando && t._quando > lastSeen)
            .map(t => ({ ...t, _tipo: 'novo_chamado' }));

          const novasRespostas = data
            .map(t => ({ ...t, _quando: parseDate(t.last_message_at) }))
            .filter(t => t._quando && t._quando > lastSeen && t.last_message_is_client)
            .map(t => ({ ...t, _tipo: 'nova_resposta' }));

          novaAtividade = [...novosChamados, ...novasRespostas];
        } else if (role === 'client') {
          novaAtividade = data
            .map(t => ({ ...t, _quando: parseDate(t.last_message_at) }))
            .filter(t => t._quando && t._quando > lastSeen && t.last_message_is_client === false)
            .map(t => ({ ...t, _tipo: 'nova_resposta' }));
        }

        novaAtividade.sort((a, b) => b._quando - a._quando);
        setActivity(novaAtividade);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const id = setInterval(load, INTERVALO_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const vencidos = alerts.filter(a => a._vencido).length;
  const totalCount = alerts.length + activity.length;

  const toggleOpen = () => {
    setOpen(o => {
      const next = !o;
      if (next) markSeen();
      return next;
    });
  };

  return (
    <div className="nb-wrap" ref={ref}>
      <button
        className={`nb-bell ${totalCount > 0 ? 'nb-bell--active' : ''}`}
        onClick={toggleOpen}
        aria-label="Notificações"
      >
        <Bell size={19} />
        {totalCount > 0 && (
          <span className={`nb-count ${vencidos > 0 ? 'nb-count--critical' : ''}`}>{totalCount}</span>
        )}
      </button>

      {open && (
        <div className="nb-dropdown">
          {isStaff && (
            <>
              <div className="nb-dropdown-head">SLA prestes a vencer / vencido</div>
              {alerts.length === 0 ? (
                <div className="nb-empty">Nenhum chamado com SLA próximo do prazo.</div>
              ) : (
                <div className="nb-list">
                  {alerts.map(a => (
                    <button
                      key={`sla-${a.id}`}
                      className={`nb-item ${a._vencido ? 'nb-item--critical' : 'nb-item--warning'}`}
                      onClick={() => { setOpen(false); navigate(`/tickets/${a.id}`); }}
                    >
                      <span className="nb-item-subject">#{a.id} {a.subject}</span>
                      <span className="nb-item-sla">
                        {a._vencido ? 'Vencido em ' : 'Vence em '}
                        {a._sla.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="nb-dropdown-head">Atividade</div>
          {activity.length === 0 ? (
            <div className="nb-empty">Nenhuma atividade nova.</div>
          ) : (
            <div className="nb-list">
              {activity.map(a => (
                <button
                  key={`act-${a._tipo}-${a.id}`}
                  className="nb-item nb-item--info"
                  onClick={() => { setOpen(false); navigate(`/tickets/${a.id}`); }}
                >
                  <span className="nb-item-subject">#{a.id} {a.subject}</span>
                  <span className="nb-item-sla">
                    {a._tipo === 'novo_chamado' ? 'Novo chamado — ' : 'Nova resposta — '}
                    {a._quando.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

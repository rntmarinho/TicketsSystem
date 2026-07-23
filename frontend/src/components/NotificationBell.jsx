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

// Bip curto via Web Audio API — sem depender de um arquivo de áudio externo.
const playChime = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Autoplay bloqueado pelo navegador antes de qualquer interação — ignora.
  }
};

const showDesktopNotification = (title, body) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    new Notification(title, { body, icon: '/favicon.svg' });
  } catch {
    // Alguns navegadores bloqueiam notificação sem Service Worker registrado.
  }
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [open, setOpen] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const ref = useRef(null);
  const lastSeenRef = useRef(null);
  const notifiedRef = useRef(null);
  const dismissedRef = useRef(null);

  const isStaff = role === 'admin' || role === 'technician';
  const seenKey = user?.id ? `notif_activity_seen_${user.id}` : null;
  const notifiedKey = user?.id ? `notif_sound_keys_${user.id}` : null;
  const dismissedKey = user?.id ? `notif_dismissed_${user.id}` : null;

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
    // Não limpa `activity` aqui — a lista some naturalmente na próxima
    // consulta (porque vai ficar mais velha que o novo "visto"). Limpar na
    // hora faria o dropdown abrir sempre vazio.
  };

  const getNotifiedSet = () => {
    if (notifiedRef.current) return notifiedRef.current;
    let stored = [];
    try {
      stored = JSON.parse((notifiedKey && localStorage.getItem(notifiedKey)) || '[]');
    } catch {
      stored = [];
    }
    notifiedRef.current = new Set(stored);
    return notifiedRef.current;
  };

  const persistNotifiedSet = (set) => {
    if (!notifiedKey) return;
    // Mantém só as últimas entradas — não precisa crescer sem limite.
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(notifiedKey, JSON.stringify(arr));
  };

  const getDismissedSet = () => {
    if (dismissedRef.current) return dismissedRef.current;
    let stored = [];
    try {
      stored = JSON.parse((dismissedKey && localStorage.getItem(dismissedKey)) || '[]');
    } catch {
      stored = [];
    }
    dismissedRef.current = new Set(stored);
    return dismissedRef.current;
  };

  const persistDismissedSet = (set) => {
    if (!dismissedKey) return;
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(dismissedKey, JSON.stringify(arr));
  };

  // Some da lista só pra este usuário (localStorage) — não afeta o chamado
  // nem a visão de outros usuários, é só um "já vi isso" pessoal.
  const dismissItem = (key) => {
    const set = getDismissedSet();
    set.add(key);
    persistDismissedSet(set);
  };

  const requestDesktopPermission = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(setDesktopPermission);
  };

  const load = () => {
    apiFetch('/tickets/')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const agora = new Date();
        const limite = new Date(agora.getTime() + LIMIAR_HORAS * 60 * 60 * 1000);

        const dismissed = getDismissedSet();

        let proximos = [];

        // Alerta de SLA é informação de operação da equipe — cliente não vê.
        if (isStaff) {
          proximos = data
            .filter(t => normalizeStatus(t.status) !== 'closed')
            .map(t => ({ ...t, _sla: parseDate(t.sla) }))
            .filter(t => t._sla && t._sla <= limite)
            .map(t => ({ ...t, _vencido: t._sla < agora }))
            .filter(t => !dismissed.has(`sla-${t.id}`))
            .sort((a, b) => a._sla - b._sla);

          setAlerts(proximos);
        }

        let novaAtividade = [];

        if (seenKey) {
          const lastSeen = getLastSeen();

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

          novaAtividade = novaAtividade.filter(t => !dismissed.has(`${t._tipo}-${t.id}`));
          novaAtividade.sort((a, b) => b._quando - a._quando);
          setActivity(novaAtividade);
        }

        // Som + notificação de desktop só pra itens ainda não notificados
        // nesta sessão/navegador — evita ficar tocando de novo a cada
        // consulta (2 em 2 minutos) pro mesmo alerta ainda em aberto.
        const chaves = [
          ...proximos.map(a => `sla-${a.id}`),
          ...novaAtividade.map(a => `${a._tipo}-${a.id}`)
        ];

        const notificados = getNotifiedSet();
        const novasChaves = chaves.filter(k => !notificados.has(k));

        if (novasChaves.length > 0) {
          playChime();

          const primeiroItem = novaAtividade[0] || proximos[0];
          const titulo = novaAtividade.length > 0
            ? 'Novo chamado ou resposta'
            : 'SLA prestes a vencer';
          const corpo = novasChaves.length === 1 && primeiroItem
            ? `#${primeiroItem.id} ${primeiroItem.subject}`
            : `${novasChaves.length} novidade(s) no sistema de chamados.`;

          showDesktopNotification(titulo, corpo);
        }

        chaves.forEach(k => notificados.add(k));
        persistNotifiedSet(notificados);
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
                      onClick={() => {
                        dismissItem(`sla-${a.id}`);
                        setAlerts(prev => prev.filter(x => x.id !== a.id));
                        setOpen(false);
                        navigate(`/tickets/${a.id}`);
                      }}
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
                  onClick={() => {
                    dismissItem(`${a._tipo}-${a.id}`);
                    setActivity(prev => prev.filter(x => !(x.id === a.id && x._tipo === a._tipo)));
                    setOpen(false);
                    navigate(`/tickets/${a.id}`);
                  }}
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

          {desktopPermission === 'default' && (
            <button className="nb-enable-desktop" onClick={requestDesktopPermission}>
              Ativar notificações no desktop
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

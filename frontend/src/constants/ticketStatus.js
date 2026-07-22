// Fonte única do vocabulário de status — usado por AllTickets, TicketDetails e Kanban.
// Antes cada tela tinha sua própria lista (parcialmente divergente).
export const STATUS_OPTIONS = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em Atendimento' },
  { value: 'pending', label: 'Pendente' },
  { value: 'closed', label: 'Fechado' }
];

// Normaliza variações vindas do backend/legado (pt-br, sinônimos) pro value canônico.
export function normalizeStatus(status) {
  if (!status) return 'open';
  const s = status.toLowerCase();

  if (s === 'aberto') return 'open';
  if (s === 'em atendimento' || s === 'andamento') return 'in_progress';
  if (s === 'pendente') return 'pending';
  if (s === 'fechado') return 'closed';

  return STATUS_OPTIONS.some(o => o.value === s) ? s : status;
}

export function getStatusMeta(status) {
  const value = normalizeStatus(status);

  const palette = {
    open: { bg: '#dbeafe', color: '#1d4ed8' },
    in_progress: { bg: '#fef3c7', color: '#b45309' },
    pending: { bg: '#eaf2f8', color: '#2980b9' },
    closed: { bg: '#dcfce7', color: '#15803d' }
  };

  const option = STATUS_OPTIONS.find(o => o.value === value);

  return {
    label: option ? option.label : (status || 'Desconhecido'),
    bg: palette[value]?.bg || '#f3f4f6',
    color: palette[value]?.color || '#374151'
  };
}

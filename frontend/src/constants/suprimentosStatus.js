// Status de acompanhamento do módulo Suprimentos — espelha os valores do
// Enum suprimentos_status no backend (gestao/models/suprimentos_models.py).
// Mesma convenção de src/constants/ticketStatus.js (STATUS_OPTIONS + getStatusMeta).
export const STATUS_OPTIONS = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_COTACAO', label: 'Em Cotação' },
  { value: 'APROVADO', label: 'Aprovado' },
  { value: 'COMPRADO', label: 'Comprado' },
  { value: 'ATRASADO', label: 'Atrasado' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

export function getStatusMeta(status) {
  const palette = {
    PENDENTE: { bg: '#eaf2f8', color: '#2980b9' },
    EM_COTACAO: { bg: '#fef3c7', color: '#b45309' },
    APROVADO: { bg: '#dbeafe', color: '#1d4ed8' },
    COMPRADO: { bg: '#dcfce7', color: '#15803d' },
    ATRASADO: { bg: '#fee2e2', color: '#991b1b' },
    CANCELADO: { bg: '#f3f4f6', color: '#374151' },
  };
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  return {
    label: option ? option.label : (status || 'Desconhecido'),
    bg: palette[status]?.bg || '#f3f4f6',
    color: palette[status]?.color || '#374151',
  };
}

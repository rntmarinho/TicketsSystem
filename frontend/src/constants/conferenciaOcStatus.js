// Situação de conferência (Financeiro) de cada Ordem de Compra — espelha o
// Enum conferencia_oc_situacao no backend (gestao/models/conferencia_oc_models.py).
export const STATUS_OPTIONS = [
  { value: 'NAO_CONFERIDO', label: 'Não conferido' },
  { value: 'CONFERIDO', label: 'Conferido' },
];

export function getStatusMeta(status) {
  const palette = {
    NAO_CONFERIDO: { bg: '#fef3c7', color: '#b45309' },
    CONFERIDO: { bg: '#dcfce7', color: '#15803d' },
  };
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  return {
    label: option ? option.label : (status || 'Desconhecido'),
    bg: palette[status]?.bg || '#f3f4f6',
    color: palette[status]?.color || '#374151',
  };
}

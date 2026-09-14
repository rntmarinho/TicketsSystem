import { apiFetch } from '../api';

export async function getDemands({ status } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const qs = params.toString();
  const r = await apiFetch(`/finance/demands/${qs ? `?${qs}` : ''}`);
  return r.json();
}

export async function createDemand(data) {
  const r = await apiFetch('/finance/demands/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function updateDemandStatus(id, status, numeroOc) {
  const r = await apiFetch(`/finance/demands/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, numero_oc: numeroOc }),
  });
  return r.json();
}

// Centros de custo do Senior (E044CCU) que aceitam rateio — sincronizado 1x/dia
// via n8n, só leitura por aqui.
export async function getCentrosCusto() {
  const r = await apiFetch('/finance/centros-custo/');
  return r.json();
}

import { apiFetch } from '../api';

export async function getAprovadoresCentroCusto() {
  const r = await apiFetch('/rh/aprovadores-centro-custo/');
  return r.json();
}

export async function setAprovadorCentroCusto(centroCusto, aprovadorId) {
  const r = await apiFetch(`/rh/aprovadores-centro-custo/${centroCusto}`, {
    method: 'PUT',
    body: JSON.stringify({ aprovador_id: aprovadorId }),
  });
  return r.json();
}

export async function deleteAprovadorCentroCusto(centroCusto) {
  const r = await apiFetch(`/rh/aprovadores-centro-custo/${centroCusto}`, {
    method: 'DELETE',
  });
  return r.json();
}

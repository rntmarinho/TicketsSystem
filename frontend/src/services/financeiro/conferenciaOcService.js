import { apiFetch } from '../api';

export async function getOrdens(busca) {
  const query = busca ? `?busca=${encodeURIComponent(busca)}` : '';
  const r = await apiFetch(`/financeiro/conferencia-oc/${query}`);
  return r.json();
}

export async function updateSituacao(numeroOc, situacao) {
  const r = await apiFetch(`/financeiro/conferencia-oc/${encodeURIComponent(numeroOc)}`, {
    method: 'PATCH',
    body: JSON.stringify({ situacao }),
  });
  return r.json();
}

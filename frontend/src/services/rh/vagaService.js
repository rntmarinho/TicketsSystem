import { apiFetch } from '../api';

export async function getVagas({ status } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const qs = params.toString();
  const r = await apiFetch(`/rh/vagas/${qs ? `?${qs}` : ''}`);
  return r.json();
}

export async function createVaga(data) {
  const r = await apiFetch('/rh/vagas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function decidirVaga(id, decisao, comentario) {
  const r = await apiFetch(`/rh/vagas/${id}/decisao`, {
    method: 'PATCH',
    body: JSON.stringify({ decisao, comentario }),
  });
  return r.json();
}

export async function marcarVagaCriada(id, referenciaVagaSenior) {
  const r = await apiFetch(`/rh/vagas/${id}/marcar-criada`, {
    method: 'PATCH',
    body: JSON.stringify({ referencia_vaga_senior: referenciaVagaSenior }),
  });
  return r.json();
}

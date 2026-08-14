import { apiFetch } from '../api';

export async function getNucleos() {
  const r = await apiFetch('/gestao/nucleos');
  return r.json();
}

export async function createNucleo(data) {
  const r = await apiFetch('/gestao/nucleos', { method: 'POST', body: JSON.stringify(data) });
  return r.json();
}

export async function updateNucleo(id, data) {
  const r = await apiFetch(`/gestao/nucleos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return r.json();
}

export async function deleteNucleo(id) {
  const r = await apiFetch(`/gestao/nucleos/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function addNucleoMembro(nucleoId, userId) {
  const r = await apiFetch(`/gestao/nucleos/${nucleoId}/membros`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
  return r.json();
}

export async function removeNucleoMembro(nucleoId, userId) {
  const r = await apiFetch(`/gestao/nucleos/${nucleoId}/membros/${userId}`, { method: 'DELETE' });
  return r.json();
}

export async function addNucleoGerente(nucleoId, userId) {
  const r = await apiFetch(`/gestao/nucleos/${nucleoId}/gerentes`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
  return r.json();
}

export async function removeNucleoGerente(nucleoId, userId) {
  const r = await apiFetch(`/gestao/nucleos/${nucleoId}/gerentes/${userId}`, { method: 'DELETE' });
  return r.json();
}

export async function getOrganograma() {
  const r = await apiFetch('/gestao/organograma');
  return r.json();
}

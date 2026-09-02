import { apiFetch } from '../api';

export async function getItems(ownerId) {
  const query = ownerId ? `?owner_id=${ownerId}` : '';
  const r = await apiFetch(`/gestao/suprimentos/${query}`);
  return r.json();
}

export async function getItem(id) {
  const r = await apiFetch(`/gestao/suprimentos/${id}`);
  return r.json();
}

export async function updateItem(id, data) {
  const r = await apiFetch(`/gestao/suprimentos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return r.json();
}

export async function deleteItem(id) {
  const r = await apiFetch(`/gestao/suprimentos/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function getCompradores() {
  const r = await apiFetch('/gestao/suprimentos/compradores');
  return r.json();
}

export async function importSpreadsheet(file) {
  const formData = new FormData();
  formData.append('arquivo', file);
  const r = await apiFetch('/gestao/suprimentos/import', { method: 'POST', body: formData });
  return r.json();
}

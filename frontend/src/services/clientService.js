import { apiFetch } from './api';

export async function getClients() {
  const response = await apiFetch('/api/clients');
  return await response.json();
}

export async function getClient(id) {
  const response = await apiFetch(`/api/clients/${id}`);
  return await response.json();
}

export async function createClient(data) {
  const response = await apiFetch('/api/clients', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updateClient(id, data) {
  const response = await apiFetch(`/api/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deleteClient(id) {
  const response = await apiFetch(`/api/clients/${id}`, {
    method: 'DELETE'
  });
  return await response.json();
}
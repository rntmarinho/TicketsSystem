import { apiFetch } from './api';

export async function getTickets() {
  const response = await apiFetch('/api/tickets');
  return await response.json();
}

export async function getTicket(id) {
  const response = await apiFetch(`/api/tickets/${id}`);
  return await response.json();
}

export async function createTicket(data) {
  const response = await apiFetch('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updateTicket(id, data) {
  const response = await apiFetch(`/api/tickets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deleteTicket(id) {
  const response = await apiFetch(`/api/tickets/${id}`, {
    method: 'DELETE'
  });
  return await response.json();
}

export async function updateStatus(id, status) {
  const response = await apiFetch(`/api/tickets/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  return await response.json();
}

export async function getMessages(ticketId) {
  const response = await apiFetch(`/api/tickets/${ticketId}/messages`);
  return await response.json();
}

export async function sendMessage(ticketId, data) {
  const response = await apiFetch(`/api/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function mergeTicket(parentId, filhoId) {
  const response = await apiFetch(`/api/tickets/${parentId}/merge`, {
    method: 'POST',
    body: JSON.stringify({ filho_id: filhoId })
  });
  return await response.json();
}
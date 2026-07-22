import { apiFetch } from './api';

export async function getTickets() {
  // A barra final previne o erro 308 de redirecionamento
  const response = await apiFetch('/tickets/');
  return await response.json();
}

export async function getTicket(id) {
  const response = await apiFetch(`/tickets/${id}`);
  return await response.json();
}

export async function createTicket(data) {
  const response = await apiFetch('/tickets/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updateTicket(id, data) {
  const response = await apiFetch(`/tickets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deleteTicket(id) {
  const response = await apiFetch(`/tickets/${id}`, {
    method: 'DELETE'
  });
  return await response.json();
}

export async function updateStatus(id, status) {
  const response = await apiFetch(`/tickets/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  return await response.json();
}

export async function updateAssignee(id, assignedTo) {
  const response = await apiFetch(`/tickets/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ assigned_to: assignedTo === '' ? null : Number(assignedTo) })
  });
  return await response.json();
}

export async function getMessages(ticketId) {
  const response = await apiFetch(`/tickets/${ticketId}/messages`);
  return await response.json();
}

export async function sendMessage(ticketId, data) {
  const response = await apiFetch(`/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}
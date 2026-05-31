import { apiFetch } from './api';

export async function getTickets() {

  const response = await apiFetch(
    '/tickets'
  );

  return await response.json();
}

export async function getTicket(id) {

  const response = await apiFetch(
    `/tickets/${id}`
  );

  return await response.json();
}

export async function createTicket(data) {

  const response = await apiFetch(
    '/tickets',
    {
      method: 'POST',
      body: JSON.stringify(data)
    }
  );

  return await response.json();
}

export async function updateStatus(
  id,
  status
) {

  const response = await apiFetch(
    `/tickets/${id}/status`,
    {
      method: 'PUT',
      body: JSON.stringify({
        status
      })
    }
  );

  return await response.json();
}
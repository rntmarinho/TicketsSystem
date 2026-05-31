import { apiFetch } from './api';

export async function getClients() {

  const response = await apiFetch(
    '/clients'
  );

  return await response.json();
}

export async function createClient(data) {

  const response = await apiFetch(
    '/clients',
    {
      method: 'POST',
      body: JSON.stringify(data)
    }
  );

  return await response.json();
}
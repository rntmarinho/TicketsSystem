const API_URL = 'http://localhost:5000';

export async function apiFetch(endpoint, options = {}) {

  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers
    }
  );

  if (response.status === 401) {

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    window.location.href = '/login';

    throw new Error('Sessão expirada');
  }

  return response;
}
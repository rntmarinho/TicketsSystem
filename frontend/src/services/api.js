// Em produção (Docker), o Nginx proxia /api → backend:5000.
// Em desenvolvimento (npm run dev), o vite.config.js proxia /api → localhost:5000.
const API_BASE_URL = '/api';

export async function apiFetch(endpoint, options = {}) {

  const token = localStorage.getItem('token');

  // Upload de arquivo (FormData) não pode ter Content-Type forçado pra
  // application/json — o navegador precisa definir o boundary do
  // multipart/form-data sozinho.
  const headers = {
    ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Interpolação da URL base com o endpoint submetido na requisição
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  return response;
}

// Helper seguro: retorna null se a resposta não tiver corpo
export async function safeJson(response) {
  const text = await response.text();
  if (!text || text.trim() === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    console.error('Resposta não é JSON válido:', text);
    return null;
  }
}
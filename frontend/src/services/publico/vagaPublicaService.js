// Serviço da página pública de vagas (Bloco B do ATS, 19/09/2026) --
// deliberadamente NÃO usa apiFetch (services/api.js): esse wrapper força
// redirect pra /login em qualquer 401, o que sequestraria a navegação de um
// candidato anônimo. Aqui é fetch puro, sem token, sem interceptor.
const API_BASE_URL = '/api';

export async function getVagasPublicas() {
  const r = await fetch(`${API_BASE_URL}/public/vagas`);
  return r.json();
}

export async function getVagaPublica(id) {
  const r = await fetch(`${API_BASE_URL}/public/vagas/${id}`);
  if (r.status === 404) return null;
  return r.json();
}

export async function candidatar(id, formData) {
  const r = await fetch(`${API_BASE_URL}/public/vagas/${id}/candidatar`, {
    method: 'POST',
    body: formData,
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, ...body };
}

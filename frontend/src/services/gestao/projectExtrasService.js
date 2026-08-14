import { apiFetch } from '../api';

// Marcos, riscos, decisões e ideias — todos escopados por projeto, mesmo
// padrão de rota (/gestao/projects/<id>/<recurso>).

export async function getMilestones(projectId) {
  const r = await apiFetch(`/gestao/projects/${projectId}/milestones`);
  return r.json();
}
export async function createMilestone(projectId, data) {
  const r = await apiFetch(`/gestao/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify(data) });
  return r.json();
}
export async function updateMilestone(id, data) {
  const r = await apiFetch(`/gestao/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return r.json();
}
export async function deleteMilestone(id) {
  const r = await apiFetch(`/gestao/milestones/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function getRisks(projectId) {
  const r = await apiFetch(`/gestao/projects/${projectId}/risks`);
  return r.json();
}
export async function createRisk(projectId, data) {
  const r = await apiFetch(`/gestao/projects/${projectId}/risks`, { method: 'POST', body: JSON.stringify(data) });
  return r.json();
}
export async function updateRisk(id, data) {
  const r = await apiFetch(`/gestao/risks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return r.json();
}
export async function deleteRisk(id) {
  const r = await apiFetch(`/gestao/risks/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function getDecisions(projectId) {
  const r = await apiFetch(`/gestao/projects/${projectId}/decisions`);
  return r.json();
}
export async function createDecision(projectId, data) {
  const r = await apiFetch(`/gestao/projects/${projectId}/decisions`, { method: 'POST', body: JSON.stringify(data) });
  return r.json();
}
export async function deleteDecision(id) {
  const r = await apiFetch(`/gestao/decisions/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function getIdeas(projectId) {
  const r = await apiFetch(`/gestao/projects/${projectId}/ideas`);
  return r.json();
}
export async function createIdea(projectId, data) {
  const r = await apiFetch(`/gestao/projects/${projectId}/ideas`, { method: 'POST', body: JSON.stringify(data) });
  return r.json();
}
export async function updateIdea(id, data) {
  const r = await apiFetch(`/gestao/ideas/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return r.json();
}
export async function convertIdea(id) {
  const r = await apiFetch(`/gestao/ideas/${id}/convert`, { method: 'POST' });
  return r.json();
}
export async function getIdeaComments(id) {
  const r = await apiFetch(`/gestao/ideas/${id}/comments`);
  return r.json();
}
export async function createIdeaComment(id, body) {
  const r = await apiFetch(`/gestao/ideas/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  return r.json();
}

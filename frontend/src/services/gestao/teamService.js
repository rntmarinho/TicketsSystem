import { apiFetch } from '../api';

export async function getTeams() {
  const r = await apiFetch('/gestao/teams/');
  return r.json();
}

export async function getStaff() {
  const r = await apiFetch('/gestao/teams/staff');
  return r.json();
}

export async function getTeamMembers(teamId) {
  const r = await apiFetch(`/gestao/teams/${teamId}/members`);
  return r.json();
}

export async function createTeam(data) {
  const r = await apiFetch('/gestao/teams/', { method: 'POST', body: JSON.stringify(data) });
  return r.json();
}

export async function updateTeam(id, data) {
  const r = await apiFetch(`/gestao/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return r.json();
}

export async function deleteTeam(id) {
  const r = await apiFetch(`/gestao/teams/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function addTeamMember(teamId, userId, role = 'MEMBRO') {
  const r = await apiFetch(`/gestao/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId, role }) });
  return r.json();
}

export async function removeTeamMember(teamId, userId) {
  const r = await apiFetch(`/gestao/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
  return r.json();
}

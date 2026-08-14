import { apiFetch } from '../api';

export async function getTeams() {
  const r = await apiFetch('/gestao/teams/');
  return r.json();
}

export async function getStaff() {
  const r = await apiFetch('/gestao/teams/staff');
  return r.json();
}

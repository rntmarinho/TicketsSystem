// Comparação de setor tolerante a maiúscula/espaço — espelha
// backend/services/department_access.py::_normalize. Evita bloquear acesso
// por causa de variação de cadastro (ex.: "suprimentos " vs "Suprimentos").
const normalize = (name) => (name || '').trim().toLowerCase();

export const isDepartment = (userDepartment, alvo) => normalize(userDepartment) === normalize(alvo);

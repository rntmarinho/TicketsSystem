import { Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { isDepartment } from './utils/department';

// Componentes e Páginas
import Sidebar from './components/Sidebar';
import NotificationBell from './components/NotificationBell';
import UserAvatar from './components/UserAvatar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import NewTicket from './pages/NewTicket';
import Login from './pages/Login';
import CreateUser from './pages/CreateUser';
import Users from './pages/Users';
import AllTickets from './pages/AllTickets';
import GestaoProjects from './pages/gestao/GestaoProjects';
import GestaoProjectDetail from './pages/gestao/GestaoProjectDetail';
import GestaoTeams from './pages/gestao/GestaoTeams';
import GestaoOrgChart from './pages/gestao/GestaoOrgChart';
import GestaoApprovals from './pages/gestao/GestaoApprovals';
import GestaoGoals from './pages/gestao/GestaoGoals';
import GestaoScorecard from './pages/gestao/GestaoScorecard';
import GestaoAuditLog from './pages/gestao/GestaoAuditLog';
import GestaoSuprimentos from './pages/gestao/GestaoSuprimentos';
import ConferenciaOC from './pages/financeiro/ConferenciaOC';
import GestaoKanbanGeral from './pages/gestao/GestaoKanbanGeral';
import CalendarView from './pages/CalendarView';
import TicketDetails from './pages/TicketDetails';
import Reports from './pages/Reports';
import ManageCategories from './pages/ManageCategories';
import Priorities from './pages/Priority';
import Clients from './pages/Clients';
import ProfileSettings from './components/ProfileSettings';
import EmailSettings from './pages/administracao/EmailSettings';
import AprovadoresCentroCusto from './pages/administracao/AprovadoresCentroCusto';
import NovaVaga from './pages/rh/NovaVaga';
import AprovacoesVagas from './pages/rh/AprovacoesVagas';
import FilaRH from './pages/rh/FilaRH';
import CandidatosVaga from './pages/rh/CandidatosVaga';
import LGPD from './pages/LGPD';
import Notes from './pages/Notes';
import ForgotPassword from './pages/ForgotPassword';
import ModulePlaceholder from './pages/ModulePlaceholder';
import GestaoConsominasReports from './pages/gestao-consominas/GestaoConsominasReports';
import NovaDemanda from './pages/financeiro/NovaDemanda';
import DemandasAbertas from './pages/financeiro/DemandasAbertas';
import TodasDemandas from './pages/financeiro/TodasDemandas';

import './App.css';

// Guarda de Rota Protegida: Impede o acesso de utilizadores não autenticados
const ProtectedRoute = ({ isAuthenticated, children }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Guarda de Rota Pública: Impede que utilizadores autenticados voltem ao Login
const PublicRoute = ({ isAuthenticated, children }) => {
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Guarda por papel: bloqueia telas administrativas para quem não tem o
// access_type necessário (ex.: 'CLIENTE' não deve alcançar /users, /clientes etc,
// mesmo digitando a URL direto).
const RoleProtectedRoute = ({ role, allowed, children }) => {
  if (!allowed.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Guarda por departamento: usada pelo módulo Suprimentos e pelos módulos
// futuros (Almoxarifado/RH/Departamento Pessoal/Financeiro), restritos a
// usuários do setor correspondente (tbl_users.department_id) — ADMIN sempre
// passa, mesma convenção de "vê tudo" usada no resto do sistema. Espelha
// services/department_access.py::require_department no backend.
const DepartmentProtectedRoute = ({ role, department, userDepartment, children }) => {
  if (role !== 'ADMIN' && !isDepartment(userDepartment, department)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Papéis com acesso ao módulo de Gestão de Projetos — espelha
// services/gestao_permissions.py::can_access_gestao no backend. Desde 02/09/2026
// TODO papel entra (inclusive CLIENTE, que aqui é o funcionário que abre chamado
// pro TI): a visibilidade dentro do módulo é por SETOR, no backend.
const GESTAO_ROLES = ['ADMIN', 'DIRETOR', 'GESTOR_PROJETO', 'APROVADOR', 'COLABORADOR', 'VISUALIZADOR', 'CLIENTE'];

// Papéis com acesso a Chamados — equipe de atendimento (ADMIN/GESTOR_PROJETO)
// + autoatendimento (CLIENTE + papéis internos da fusão com Gestão, que até
// aqui não tinham como abrir chamado nenhum). Espelha
// backend/tickets/ticket_routes.py::SELF_SERVICE_ROLES.
const TICKET_ROLES = ['ADMIN', 'GESTOR_PROJETO', 'CLIENTE', 'COLABORADOR', 'DIRETOR', 'APROVADOR', 'VISUALIZADOR'];

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role, user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return null;
  }

  // Página inicial (09/09/2026) não tem barra lateral — o botão de abrir menu
  // não faz sentido lá (não tem nada pra abrir).
  const isHome = location.pathname === '/';

  return (
    <Routes>
      {/* Rota de Login Protegida contra utilizadores já autenticados */}
      <Route
        path="/login"
        element={
          <PublicRoute isAuthenticated={isAuthenticated}>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <PublicRoute isAuthenticated={isAuthenticated}>
            <ForgotPassword />
          </PublicRoute>
        }
      />

      {/* Escopo de Rotas Privadas encapsuladas pela ProtectedRoute */}
      <Route
        path="/*"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <div className="app-layout">
              {!isHome && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={role} />}
              <main className="content">

                <div className="top-bar">
                  {!isHome && (
                    <button
                      className="hamburger-btn"
                      onClick={() => setSidebarOpen(true)}
                      aria-label="Abrir menu"
                    >
                      <Menu size={22} />
                    </button>
                  )}

                  <div className="top-bar-actions">
                    {/* O componente decide sozinho o que mostrar por papel (alertas de SLA
                        de chamado, atividade, e agora notificações do módulo de gestão) —
                        sempre montado pra qualquer papel autenticado. */}
                    <NotificationBell />
                    {/* Foto/iniciais do usuário — atalho pra Configurações > Meu Perfil */}
                    <Link to="/configuracoes" className="topbar-avatar" title="Meu perfil">
                      <UserAvatar userId={user?.id} name={user?.name} hasPicture={user?.has_picture} size={34} />
                    </Link>
                    <button className="logout-btn-top" onClick={handleLogout}>
                      <LogOut size={18} /> Sair
                    </button>
                  </div>
                </div>

                <Routes>
                  {/* Página inicial (09/09/2026): escolha de módulo, igual pra todo papel —
                      substitui o antigo Dashboard/redirect especial de VISUALIZADOR aqui. */}
                  <Route path="/" element={<Home />} />

                  {/* Painel do módulo Chamados (antigo conteúdo de "/") */}
                  <Route
                    path="/chamados"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <Dashboard />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/novo-chamado"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <NewTicket />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/users"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN', 'GESTOR_PROJETO']}>
                        <Users />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/users/novo"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN']}>
                        <CreateUser />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/tickets"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <AllTickets />
                      </RoleProtectedRoute>
                    }
                  />
                  {/* Módulo antigo de projetos/kanban/gantt (chamados type='tarefa')
                      aposentado na Fase 1 da fusão com o APPCNS — /kanban e /gantt
                      redirecionam pra tela de Projetos do módulo de gestão novo, já
                      que lá não existe mais "o" board único (é por projeto). */}
                  {/* /kanban: desde 02/09/2026 é o Kanban geral de tarefas (todos os projetos
                      visíveis por setor), não mais um redirect pra lista de projetos. */}
                  <Route path="/kanban" element={<Navigate to="/gestao/kanban" replace />} />
                  <Route
                    path="/gestao/kanban"
                    element={
                      <RoleProtectedRoute role={role} allowed={GESTAO_ROLES}>
                        <GestaoKanbanGeral />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route path="/gantt" element={<Navigate to="/gestao/projetos" replace />} />
                  <Route
                    path="/projetos"
                    element={<Navigate to="/gestao/projetos" replace />}
                  />
                  <Route
                    path="/gestao/projetos"
                    element={
                      <RoleProtectedRoute role={role} allowed={GESTAO_ROLES}>
                        <GestaoProjects />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao/projetos/:id"
                    element={
                      <RoleProtectedRoute role={role} allowed={GESTAO_ROLES}>
                        <GestaoProjectDetail />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao/equipes"
                    element={
                      <RoleProtectedRoute role={role} allowed={GESTAO_ROLES}>
                        <GestaoTeams />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao/organograma"
                    element={
                      <RoleProtectedRoute role={role} allowed={GESTAO_ROLES}>
                        <GestaoOrgChart />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao/aprovacoes"
                    element={
                      <RoleProtectedRoute role={role} allowed={GESTAO_ROLES}>
                        <GestaoApprovals />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao/metas"
                    element={
                      <RoleProtectedRoute role={role} allowed={GESTAO_ROLES}>
                        <GestaoGoals />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao/indicadores"
                    element={
                      <RoleProtectedRoute role={role} allowed={GESTAO_ROLES}>
                        <GestaoScorecard />
                      </RoleProtectedRoute>
                    }
                  />
                  {/* Auditoria (09/09/2026): virou parte de "Administração do sistema"
                      — só ADMIN (antes também DIRETOR), decisão explícita da Renata. */}
                  <Route
                    path="/gestao/auditoria"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN']}>
                        <GestaoAuditLog />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao/suprimentos"
                    element={
                      <DepartmentProtectedRoute role={role} department="Suprimentos" userDepartment={user?.department}>
                        <GestaoSuprimentos />
                      </DepartmentProtectedRoute>
                    }
                  />
                  {/* Módulos futuros (09/09/2026): sem conteúdo ainda, só o mesmo
                      padrão de restrição por setor já usado no Suprimentos. */}
                  <Route
                    path="/almoxarifado"
                    element={
                      <DepartmentProtectedRoute role={role} department="Almoxarifado" userDepartment={user?.department}>
                        <ModulePlaceholder title="Almoxarifado e Patrimônio" />
                      </DepartmentProtectedRoute>
                    }
                  />
                  <Route
                    path="/rh"
                    element={
                      <DepartmentProtectedRoute role={role} department="RH" userDepartment={user?.department}>
                        <FilaRH />
                      </DepartmentProtectedRoute>
                    }
                  />
                  {/* Pipeline de candidatos por vaga (Bloco A do ATS, 19/09/2026):
                      só RH/ADMIN, mesmo guarda de departamento de /rh -- o
                      backend também restringe (decisão da Renata: nem o
                      aprovador/gestor da vaga vê candidato). */}
                  <Route
                    path="/rh/vagas/:id/candidatos"
                    element={
                      <DepartmentProtectedRoute role={role} department="RH" userDepartment={user?.department}>
                        <CandidatosVaga />
                      </DepartmentProtectedRoute>
                    }
                  />
                  {/* Solicitar vaga e ver aprovações (14/09/2026): abertas a todo
                      mundo, igual ao padrão do Financeiro -- o filtro de quem vê
                      o quê é feito dentro de cada tela/endpoint, não no gate da rota. */}
                  <Route
                    path="/rh/nova-vaga"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <NovaVaga />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/rh/vagas/:id/editar"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <NovaVaga />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/rh/aprovacoes"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <AprovacoesVagas />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/departamento-pessoal"
                    element={
                      <DepartmentProtectedRoute role={role} department="Departamento Pessoal" userDepartment={user?.department}>
                        <ModulePlaceholder title="Departamento Pessoal" />
                      </DepartmentProtectedRoute>
                    }
                  />
                  {/* Financeiro (09/09/2026): primeiro módulo com conteúdo de verdade —
                      demandas internas. Aberto a TODO mundo (não mais restrito por
                      setor): qualquer um abre e vê as próprias; só ADMIN/setor
                      Financeiro vê e conclui todas — escopo decidido dentro de cada
                      tela/endpoint, não no gate da rota. */}
                  <Route path="/financeiro" element={<Navigate to="/financeiro/abertas" replace />} />
                  <Route
                    path="/financeiro/nova"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <NovaDemanda />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/financeiro/abertas"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <DemandasAbertas />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/financeiro/todas"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <TodasDemandas />
                      </RoleProtectedRoute>
                    }
                  />
                  {/* Gestão Consominas (09/09/2026): relatórios corporativos, começando
                      pelo de Suprimentos (tirado de dentro de /relatorios) — só ADMIN/DIRETOR. */}
                  <Route
                    path="/gestao-consominas"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN', 'DIRETOR']}>
                        <GestaoConsominasReports />
                      </RoleProtectedRoute>
                    }
                  />
                  {/* Calendário (09/09/2026): abriu pra todo mundo — mostra sempre só os
                      próprios itens da pessoa, filtro feito dentro de CalendarView.jsx. */}
                  <Route
                    path="/financeiro/conferencia-oc"
                    element={
                      <DepartmentProtectedRoute role={role} department="Financeiro" userDepartment={user?.department}>
                        <ConferenciaOC />
                      </DepartmentProtectedRoute>
                    }
                  />
                  <Route
                    path="/calendario"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <CalendarView />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route path="/tickets/:id" element={<TicketDetails />} />
                  <Route
                    path="/relatorios"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN', 'GESTOR_PROJETO', 'VISUALIZADOR']}>
                        <Reports />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/categorias"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN']}>
                        <ManageCategories />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/prioridades"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN']}>
                        <Priorities />
                      </RoleProtectedRoute>
                    }
                  />
                  {/* /perfil (tela antiga, órfã) → Configurações > Meu Perfil, que agora é pra todo mundo */}
                  <Route path="/perfil" element={<Navigate to="/configuracoes" replace />} />
                  <Route
                    path="/clientes"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN']}>
                        <Clients />
                      </RoleProtectedRoute>
                    }
                  />
                  {/* Config. de E-mail (09/09/2026): tirada de dentro de Configurações,
                      agora é tela própria dentro de Administração do sistema — só ADMIN. */}
                  <Route
                    path="/administracao/email"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN']}>
                        <EmailSettings />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/administracao/aprovadores-centro-custo"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN']}>
                        <AprovadoresCentroCusto />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route path="/LGPD" element={<LGPD />} />
                  {/* Anotações abertas pra todo mundo desde 09/09/2026 (antes só
                      ADMIN/GESTOR_PROJETO) — restrito por setor dentro da tela/backend. */}
                  <Route
                    path="/anotacoes"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <Notes />
                      </RoleProtectedRoute>
                    }
                  />
                  {/* Configurações (09/09/2026): só o Meu Perfil agora — a aba de
                      E-mail saiu pra /administracao/email. Pra todo papel. */}
                  <Route
                    path="/configuracoes"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <ProfileSettings />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;

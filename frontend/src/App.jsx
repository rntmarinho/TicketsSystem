import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { isDepartment } from './utils/department';

// Componentes e Páginas
import Sidebar from './components/Sidebar';
import NotificationBell from './components/NotificationBell';
import PresenceAndCalls from './components/PresenceAndCalls';
import UserAvatar from './components/UserAvatar';
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
import GestaoChat from './pages/gestao/GestaoChat';
import GestaoKanbanGeral from './pages/gestao/GestaoKanbanGeral';
import PortalCliente from './pages/portal-cliente/PortalCliente';
import PortalClienteProject from './pages/portal-cliente/PortalClienteProject';
import CalendarView from './pages/CalendarView';
import TicketDetails from './pages/TicketDetails';
import Reports from './pages/Reports';
import ManageCategories from './pages/ManageCategories';
import Priorities from './pages/Priority';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import LGPD from './pages/LGPD';
import Notes from './pages/Notes';
import ForgotPassword from './pages/ForgotPassword';

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

// Guarda por departamento: usada pelo módulo Suprimentos, restrito a
// usuários do setor "Suprimentos" (tbl_users.department_id) — ADMIN sempre
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
  const { isAuthenticated, role, user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return null;
  }

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
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={role} />
              <main className="content">

                <div className="top-bar">
                  <button
                    className="hamburger-btn"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Abrir menu"
                  >
                    <Menu size={22} />
                  </button>

                  <div className="top-bar-actions">
                    {/* O componente decide sozinho o que mostrar por papel (alertas de SLA
                        de chamado, atividade, e agora notificações do módulo de gestão) —
                        sempre montado pra qualquer papel autenticado. */}
                    <NotificationBell />
                    {/* Fase 3: heartbeat de presença + aviso de chamada chegando (só papéis
                        com acesso ao módulo de gestão — o componente decide sozinho). */}
                    <PresenceAndCalls />
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
                  {/* 'VISUALIZADOR' não tem Painel Inicial — manda pros Projetos em vez de
                      usar RoleProtectedRoute aqui (que redireciona pra "/" e
                      criaria um loop infinito nesta rota específica). */}
                  <Route
                    path="/"
                    element={role === 'VISUALIZADOR' ? <Navigate to="/gestao/projetos" replace /> : <Dashboard />}
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
                  <Route
                    path="/gestao/auditoria"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN', 'DIRETOR']}>
                        <GestaoAuditLog />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao/chat"
                    element={
                      <RoleProtectedRoute role={role} allowed={GESTAO_ROLES}>
                        <GestaoChat />
                      </RoleProtectedRoute>
                    }
                  />
                  {/* Portal do Cliente (Fase 3): leitura dos projetos vinculados em
                      project_clients — só CLIENTE; backend em /portal-cliente/*. */}
                  <Route
                    path="/portal-cliente"
                    element={
                      <RoleProtectedRoute role={role} allowed={['CLIENTE']}>
                        <PortalCliente />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/portal-cliente/projetos/:id"
                    element={
                      <RoleProtectedRoute role={role} allowed={['CLIENTE']}>
                        <PortalClienteProject />
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
                  <Route
                    path="/calendario"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN', 'GESTOR_PROJETO', 'VISUALIZADOR']}>
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
                  <Route path="/LGPD" element={<LGPD />} />
                  <Route
                    path="/anotacoes"
                    element={
                      <RoleProtectedRoute role={role} allowed={['ADMIN', 'GESTOR_PROJETO']}>
                        <Notes />
                      </RoleProtectedRoute>
                    }
                  />
                  {/* Configurações: aba Meu Perfil pra todo papel; a aba de E-mail só
                      aparece pra ADMIN (filtro dentro de Settings.jsx). */}
                  <Route
                    path="/configuracoes"
                    element={
                      <RoleProtectedRoute role={role} allowed={TICKET_ROLES}>
                        <Settings />
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
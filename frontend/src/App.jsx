import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from './context/AuthContext';

// Componentes e Páginas
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import NewTicket from './pages/NewTicket';
import Login from './pages/Login';
import CreateUser from './pages/CreateUser';
import Users from './pages/Users';
import AllTickets from './pages/AllTickets';
import Kanban from './pages/Kanban';
import Projects from './pages/Projects';
import TicketDetails from './pages/TicketDetails';
import Reports from './pages/Reports';
import ManageCategories from './pages/ManageCategories';
import Profile from './pages/Profile';
import Priorities from './pages/Priority';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import LGPD from './pages/LGPD';
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
// access_type necessário (ex.: 'client' não deve alcançar /users, /clientes etc,
// mesmo digitando a URL direto).
const RoleProtectedRoute = ({ role, allowed, children }) => {
  if (!allowed.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  const navigate = useNavigate();
  const { isAuthenticated, role, loading, logout } = useAuth();
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
                  <button className="logout-btn-top" onClick={handleLogout}>
                    <LogOut size={18} /> Sair
                  </button>
                </div>

                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/novo-chamado" element={<NewTicket />} />
                  <Route
                    path="/users"
                    element={
                      <RoleProtectedRoute role={role} allowed={['admin', 'technician']}>
                        <Users />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/users/novo"
                    element={
                      <RoleProtectedRoute role={role} allowed={['admin']}>
                        <CreateUser />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route path="/tickets" element={<AllTickets />} />
                  <Route
                    path="/kanban"
                    element={
                      <RoleProtectedRoute role={role} allowed={['admin', 'technician']}>
                        <Kanban />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/projetos"
                    element={
                      <RoleProtectedRoute role={role} allowed={['admin', 'technician']}>
                        <Projects />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route path="/tickets/:id" element={<TicketDetails />} />
                  <Route
                    path="/relatorios"
                    element={
                      <RoleProtectedRoute role={role} allowed={['admin', 'technician']}>
                        <Reports />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/categorias"
                    element={
                      <RoleProtectedRoute role={role} allowed={['admin']}>
                        <ManageCategories />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route
                    path="/prioridades"
                    element={
                      <RoleProtectedRoute role={role} allowed={['admin']}>
                        <Priorities />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route path="/perfil" element={<Profile />} />
                  <Route
                    path="/clientes"
                    element={
                      <RoleProtectedRoute role={role} allowed={['admin']}>
                        <Clients />
                      </RoleProtectedRoute>
                    }
                  />
                  <Route path="/LGPD" element={<LGPD />} />
                  <Route
                    path="/configuracoes"
                    element={
                      <RoleProtectedRoute role={role} allowed={['admin']}>
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
import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

// Componentes e Páginas
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import NewTicket from './pages/NewTicket';
import Login from './pages/Login';
import CreateUser from './pages/CreateUser';
import Users from './pages/Users';
import AllTickets from './pages/AllTickets';
import TicketDetails from './pages/TicketDetails';
import Reports from './pages/Reports';
import ManageCategories from './pages/ManageCategories';
import Profile from './pages/Profile';
import Priorities from './pages/Priority';

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

function App() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <Routes>
      {/* Rota de Login Protegida contra utilizadores já autenticados */}
      <Route 
        path="/login" 
        element={
          <PublicRoute isAuthenticated={isAuthenticated}>
            <Login setAuth={setIsAuthenticated} />
          </PublicRoute>
        } 
      />

      {/* Escopo de Rotas Privadas encapsuladas pela ProtectedRoute */}
      <Route 
        path="/*" 
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <div className="app-layout">
              <Sidebar />
              <main className="content">
                
                <div className="top-bar">
                  <button className="logout-btn-top" onClick={handleLogout}>
                    <LogOut size={18} /> Sair
                  </button>
                </div>

                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/novo-chamado" element={<NewTicket />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/users/novo" element={<CreateUser />} />
                  <Route path="/tickets" element={<AllTickets />} />
                  <Route path="/tickets/:id" element={<TicketDetails />} />
                  <Route path="/relatorios" element={<Reports />} />
                  <Route path="/categorias" element={<ManageCategories />} />
                  <Route path="/prioridades" element={<Priorities />} />
                  <Route path="/perfil" element={<Profile />} />
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
import { LayoutDashboard,
  Ticket,
  Users,
  PlusCircle,
  Building2,
  BarChart,
  Scale,
  Settings,
  Tag,
  CircleAlert,
  X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, role }) => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? "nav-item active" : "nav-item";
  const isAdmin = role === 'admin';
  const isAdminOrTechnician = role === 'admin' || role === 'technician';

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Overlay escuro no mobile quando sidebar está aberta */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} />
      )}

      <div className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>

        <div className="sidebar-top">
          <img src="/consominas.jpg" alt="Logo" className="logo" />
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Fechar menu">
            <X size={22} />
          </button>
        </div>

        <nav>
          <Link to="/" className={isActive("/")} onClick={handleNavClick}>
            <LayoutDashboard size={20} /> Painel Inicial
          </Link>

          <Link to="/novo-chamado" className={isActive("/novo-chamado")} onClick={handleNavClick}>
            <PlusCircle size={20} /> Abrir Chamado
          </Link>

          <Link to="/tickets" className={isActive("/tickets")} onClick={handleNavClick}>
            <Ticket size={20} /> Todos os Chamados
          </Link>

          {isAdminOrTechnician && (
            <Link to="/users" className={isActive("/users")} onClick={handleNavClick}>
              <Users size={20} /> Usuários
            </Link>
          )}

          {isAdmin && (
            <Link to="/clientes" className={isActive("/clientes")} onClick={handleNavClick}>
              <Building2 size={20} /> Clientes
            </Link>
          )}

          {isAdmin && (
            <Link to="/categorias" className={isActive("/categorias")} onClick={handleNavClick}>
              <Tag size={20} /> Categorias
            </Link>
          )}

          {isAdmin && (
            <Link to="/prioridades" className={isActive("/prioridades")} onClick={handleNavClick}>
              <CircleAlert size={20} /> Prioridade
            </Link>
          )}

          {isAdminOrTechnician && (
            <Link to="/relatorios" className={isActive("/relatorios")} onClick={handleNavClick}>
              <BarChart size={20} /> Relatórios
            </Link>
          )}

          {isAdmin && (
            <Link to="/configuracoes" className={isActive("/configuracoes")} onClick={handleNavClick}>
              <Settings size={20} /> Configurações
            </Link>
          )}

          <Link to="/LGPD" className={isActive("/LGPD")} onClick={handleNavClick}>
            <Scale size={20} /> LGPD
          </Link>
        </nav>

      </div>
    </>
  );
};

export default Sidebar;
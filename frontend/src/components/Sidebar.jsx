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
  LayoutGrid,
  Briefcase,
  GanttChartSquare,
  CalendarDays,
  X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, role }) => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? "nav-item active" : "nav-item";
  const isAdmin = role === 'admin';
  const isAdminOrTechnician = role === 'admin' || role === 'technician';
  const isOperational = role === 'admin' || role === 'technician' || role === 'client';
  const canSeeReportsGanttCalendar = role === 'admin' || role === 'technician' || role === 'viewer';

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
          <img src="/consominas-logo.png" alt="Grupo Consominas" className="logo" />
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Fechar menu">
            <X size={22} />
          </button>
        </div>

        <nav>
          {isOperational && (
            <Link to="/" className={isActive("/")} onClick={handleNavClick}>
              <LayoutDashboard size={20} /> Painel Inicial
            </Link>
          )}

          {isOperational && (
            <Link to="/novo-chamado" className={isActive("/novo-chamado")} onClick={handleNavClick}>
              <PlusCircle size={20} /> Abrir Chamado
            </Link>
          )}

          {isOperational && (
            <Link to="/tickets" className={isActive("/tickets")} onClick={handleNavClick}>
              <Ticket size={20} /> Todos os Chamados
            </Link>
          )}

          {isAdminOrTechnician && (
            <Link to="/kanban" className={isActive("/kanban")} onClick={handleNavClick}>
              <LayoutGrid size={20} /> Kanban
            </Link>
          )}

          {canSeeReportsGanttCalendar && (
            <Link to="/projetos" className={isActive("/projetos")} onClick={handleNavClick}>
              <Briefcase size={20} /> Projetos
            </Link>
          )}

          {canSeeReportsGanttCalendar && (
            <Link to="/gantt" className={isActive("/gantt")} onClick={handleNavClick}>
              <GanttChartSquare size={20} /> Gantt
            </Link>
          )}

          {canSeeReportsGanttCalendar && (
            <Link to="/calendario" className={isActive("/calendario")} onClick={handleNavClick}>
              <CalendarDays size={20} /> Calendário
            </Link>
          )}

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

          {canSeeReportsGanttCalendar && (
            <Link to="/relatorios" className={isActive("/relatorios")} onClick={handleNavClick}>
              <BarChart size={20} /> Relatórios
            </Link>
          )}

          {isAdmin && (
            <Link to="/configuracoes" className={isActive("/configuracoes")} onClick={handleNavClick}>
              <Settings size={20} /> Configurações
            </Link>
          )}

          {isOperational && (
            <Link to="/LGPD" className={isActive("/LGPD")} onClick={handleNavClick}>
              <Scale size={20} /> LGPD
            </Link>
          )}
        </nav>

      </div>
    </>
  );
};

export default Sidebar;
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
  Briefcase,
  CalendarDays,
  StickyNote,
  Network,
  CheckSquare,
  Target,
  Gauge,
  ScrollText,
  Package,
  Columns3,
  MessageSquare,
  FolderKanban,
  ChevronRight,
  X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isDepartment } from '../utils/department';
import './Sidebar.css';

// Menu com submenus recolhível — usado por "Chamados" e "Projetos" pra
// reduzir a quantidade de itens sempre visíveis na barra lateral. `items`
// já vem filtrado pelos que o papel do usuário pode ver; o grupo inteiro
// só aparece se sobrar pelo menos um.
const NavGroup = ({ groupKey, icon: Icon, label, items, openGroup, onToggle, isActive, onNavClick, currentPath }) => {
  if (items.length === 0) return null;
  const anyActive = items.some((item) => currentPath === item.to);
  const isOpen = openGroup === groupKey || (openGroup === null && anyActive);

  return (
    <>
      <button
        type="button"
        className={`nav-group-header${anyActive ? ' active' : ''}`}
        onClick={() => onToggle(groupKey, anyActive)}
      >
        <Icon size={20} />
        <span>{label}</span>
        <ChevronRight size={16} className={`nav-group-chevron${isOpen ? ' open' : ''}`} />
      </button>

      {isOpen && (
        <div className="nav-group-children">
          {items.map(({ to, icon: ItemIcon, label: itemLabel }) => (
            <Link key={to} to={to} className={isActive(to, 'nav-subitem')} onClick={onNavClick}>
              <ItemIcon size={17} /> {itemLabel}
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

const Sidebar = ({ isOpen, onClose, role }) => {
  const location = useLocation();
  const { user } = useAuth();

  // null = nenhum grupo forçado aberto/fechado manualmente ainda — nesse
  // caso cada grupo abre sozinho se a rota atual for uma de suas filhas.
  const [openGroup, setOpenGroup] = useState(null);

  const isActive = (path, base = 'nav-item') => location.pathname === path ? `${base} active` : base;
  const isAdmin = role === 'ADMIN';
  // Item exclusivo do setor Suprimentos (tbl_users.department_id) — não é
  // controlado por access_type como o resto do menu. Espelha
  // App.jsx::DepartmentProtectedRoute / services/department_access.py.
  const canSeeSuprimentos = isAdmin || isDepartment(user?.department, 'Suprimentos');
  const isAdminOrTechnician = role === 'ADMIN' || role === 'GESTOR_PROJETO';
  // Espelha App.jsx::TICKET_ROLES / backend/tickets/ticket_routes.py::SELF_SERVICE_ROLES —
  // equipe de atendimento + autoatendimento (cliente e papéis internos da fusão com Gestão).
  const isOperational = ['ADMIN', 'GESTOR_PROJETO', 'CLIENTE', 'COLABORADOR', 'DIRETOR', 'APROVADOR', 'VISUALIZADOR'].includes(role);
  const canSeeReportsGanttCalendar = role === 'ADMIN' || role === 'GESTOR_PROJETO' || role === 'VISUALIZADOR';
  // Espelha services/gestao_permissions.py::can_access_gestao — CLIENTE não
  // entra no módulo de gestão; tem o Portal do Cliente (item próprio abaixo).
  const canSeeGestao = ['ADMIN', 'DIRETOR', 'GESTOR_PROJETO', 'APROVADOR', 'COLABORADOR', 'VISUALIZADOR'].includes(role);
  const isAdminOrDiretor = role === 'ADMIN' || role === 'DIRETOR';

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const toggleGroup = (key, currentlyOpen) => {
    setOpenGroup((prev) => {
      const isOpenNow = prev === key || (prev === null && currentlyOpen);
      return isOpenNow ? '__none__' : key;
    });
  };

  // Barra lateral estava sobrecarregada — agrupados em "Chamados" (rotina
  // de atendimento) e "Projetos" (rotina de gestão), pedido da Renata (24/08).
  const chamadosItems = [
    isOperational && { to: '/', icon: LayoutDashboard, label: 'Chamados Abertos' },
    isOperational && { to: '/novo-chamado', icon: PlusCircle, label: 'Abrir Chamado' },
    isOperational && { to: '/tickets', icon: Ticket, label: 'Todos os Chamados' },
    isAdmin && { to: '/categorias', icon: Tag, label: 'Categorias' },
    isAdmin && { to: '/prioridades', icon: CircleAlert, label: 'Prioridade' },
  ].filter(Boolean);

  const projetosItems = [
    canSeeGestao && { to: '/gestao/projetos', icon: Briefcase, label: 'Visão Geral' },
    canSeeGestao && { to: '/kanban', icon: Columns3, label: 'Kanban' },
    canSeeGestao && { to: '/gestao/metas', icon: Target, label: 'Metas' },
    canSeeGestao && { to: '/gestao/indicadores', icon: Gauge, label: 'Indicadores' },
  ].filter(Boolean);

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
          <NavGroup
            groupKey="chamados"
            icon={Ticket}
            label="Chamados"
            items={chamadosItems}
            openGroup={openGroup}
            onToggle={toggleGroup}
            isActive={isActive}
            onNavClick={handleNavClick}
            currentPath={location.pathname}
          />

          <NavGroup
            groupKey="projetos"
            icon={Briefcase}
            label="Projetos"
            items={projetosItems}
            openGroup={openGroup}
            onToggle={toggleGroup}
            isActive={isActive}
            onNavClick={handleNavClick}
            currentPath={location.pathname}
          />

          {canSeeGestao && (
            <Link to="/gestao/equipes" className={isActive("/gestao/equipes")} onClick={handleNavClick}>
              <Users size={20} /> Equipes
            </Link>
          )}

          {canSeeGestao && (
            <Link to="/gestao/organograma" className={isActive("/gestao/organograma")} onClick={handleNavClick}>
              <Network size={20} /> Organograma
            </Link>
          )}

          {canSeeGestao && (
            <Link to="/gestao/aprovacoes" className={isActive("/gestao/aprovacoes")} onClick={handleNavClick}>
              <CheckSquare size={20} /> Aprovações
            </Link>
          )}

          {canSeeGestao && (
            <Link to="/gestao/chat" className={isActive("/gestao/chat")} onClick={handleNavClick}>
              <MessageSquare size={20} /> Chat
            </Link>
          )}

          {role === 'CLIENTE' && (
            <Link to="/portal-cliente" className={isActive("/portal-cliente")} onClick={handleNavClick}>
              <FolderKanban size={20} /> Meus Projetos
            </Link>
          )}

          {isAdminOrDiretor && (
            <Link to="/gestao/auditoria" className={isActive("/gestao/auditoria")} onClick={handleNavClick}>
              <ScrollText size={20} /> Auditoria
            </Link>
          )}

          {canSeeSuprimentos && (
            <Link to="/gestao/suprimentos" className={isActive("/gestao/suprimentos")} onClick={handleNavClick}>
              <Package size={20} /> Suprimentos
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

          {isAdminOrTechnician && (
            <Link to="/anotacoes" className={isActive("/anotacoes")} onClick={handleNavClick}>
              <StickyNote size={20} /> Anotações
            </Link>
          )}

          {isAdmin && (
            <Link to="/clientes" className={isActive("/clientes")} onClick={handleNavClick}>
              <Building2 size={20} /> Clientes
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

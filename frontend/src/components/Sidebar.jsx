import {
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
  LayoutDashboard,
  Network,
  CheckSquare,
  Target,
  Gauge,
  ScrollText,
  Package,
  Columns3,
  Home,
  Wallet,
  Send,
  Inbox,
  ListChecks,
  X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

// 09/09/2026 (pedido da Renata): a barra lateral deixou de mostrar tudo junto
// — agora mostra só os itens do MÓDULO em que a URL atual está, calculado
// pelo prefixo do caminho. Cada módulo continua morando exatamente nas
// mesmas rotas de sempre (nada de URL mudou, só o menu ao lado). Fora de
// qualquer módulo (página inicial e as ações universais — Configurações,
// Calendário, Organograma, Anotações) não tem lista, só o link de voltar.
function buildModules(ctx) {
  return [
    {
      key: 'chamados',
      label: 'Chamados',
      icon: Ticket,
      prefixes: ['/chamados', '/tickets', '/novo-chamado', '/categorias', '/prioridades', '/relatorios'],
      items: [
        ctx.isOperational && { to: '/chamados', icon: LayoutDashboard, label: 'Painel' },
        ctx.isOperational && { to: '/novo-chamado', icon: PlusCircle, label: 'Abrir Chamado' },
        ctx.isOperational && { to: '/tickets', icon: Ticket, label: 'Todos os Chamados' },
        ctx.isAdmin && { to: '/categorias', icon: Tag, label: 'Categorias' },
        ctx.isAdmin && { to: '/prioridades', icon: CircleAlert, label: 'Prioridade' },
        ctx.canSeeReports && { to: '/relatorios', icon: BarChart, label: 'Relatórios' },
      ].filter(Boolean),
    },
    {
      key: 'projetos',
      label: 'Projetos',
      icon: Briefcase,
      prefixes: ['/gestao/projetos', '/gestao/kanban', '/gestao/metas', '/gestao/indicadores', '/gestao/aprovacoes'],
      items: [
        ctx.canSeeGestao && { to: '/gestao/projetos', icon: Briefcase, label: 'Visão Geral' },
        ctx.canSeeGestao && { to: '/gestao/kanban', icon: Columns3, label: 'Kanban' },
        ctx.canSeeGestao && { to: '/gestao/metas', icon: Target, label: 'Metas' },
        ctx.canSeeGestao && { to: '/gestao/indicadores', icon: Gauge, label: 'Indicadores' },
        ctx.canSeeGestao && { to: '/gestao/aprovacoes', icon: CheckSquare, label: 'Aprovações' },
      ].filter(Boolean),
    },
    {
      key: 'suprimentos',
      label: 'Suprimentos',
      icon: Package,
      prefixes: ['/gestao/suprimentos'],
      items: [],
    },
    {
      key: 'administracao',
      label: 'Administração',
      icon: ScrollText,
      prefixes: ['/administracao', '/clientes', '/LGPD', '/gestao/auditoria', '/users', '/gestao/equipes'],
      items: [
        ctx.isAdmin && { to: '/administracao/email', icon: Settings, label: 'Config. de E-mail' },
        ctx.isAdmin && { to: '/clientes', icon: Building2, label: 'Clientes' },
        ctx.isAdmin && { to: '/LGPD', icon: Scale, label: 'LGPD' },
        ctx.isAdmin && { to: '/gestao/auditoria', icon: ScrollText, label: 'Auditoria' },
        ctx.isAdmin && { to: '/users', icon: Users, label: 'Usuários' },
        ctx.isAdmin && { to: '/gestao/equipes', icon: Users, label: 'Equipes' },
      ].filter(Boolean),
    },
    {
      key: 'gestao-consominas',
      label: 'Gestão Consominas',
      icon: Network,
      prefixes: ['/gestao-consominas'],
      items: [],
    },
    {
      // Financeiro (09/09/2026): aberto a todo mundo — os 3 itens aparecem
      // pra qualquer papel, o escopo (só as próprias vs. todas) é decidido
      // dentro de cada tela/endpoint, não no menu.
      key: 'financeiro',
      label: 'Financeiro',
      icon: Wallet,
      prefixes: ['/financeiro'],
      items: [
        ctx.isOperational && { to: '/financeiro/nova', icon: Send, label: 'Solicitar Demanda' },
        ctx.isOperational && { to: '/financeiro/abertas', icon: Inbox, label: 'Demandas em Aberto' },
        ctx.isOperational && { to: '/financeiro/todas', icon: ListChecks, label: 'Todas as Demandas' },
      ].filter(Boolean),
    },
    {
      key: 'futuro',
      label: 'Em breve',
      icon: Package,
      prefixes: ['/almoxarifado', '/rh', '/departamento-pessoal'],
      items: [],
    },
  ];
}

const Sidebar = ({ isOpen, onClose, role }) => {
  const location = useLocation();

  // Página inicial não tem barra lateral nenhuma (pedido explícito da Renata).
  if (location.pathname === '/') return null;

  const isActive = (path) => (location.pathname === path ? 'nav-item active' : 'nav-item');
  const isAdmin = role === 'ADMIN';
  const isOperational = ['ADMIN', 'GESTOR_PROJETO', 'CLIENTE', 'COLABORADOR', 'DIRETOR', 'APROVADOR', 'VISUALIZADOR'].includes(role);
  const canSeeReports = role === 'ADMIN' || role === 'GESTOR_PROJETO' || role === 'VISUALIZADOR';
  const canSeeGestao = ['ADMIN', 'DIRETOR', 'GESTOR_PROJETO', 'APROVADOR', 'COLABORADOR', 'VISUALIZADOR', 'CLIENTE'].includes(role);

  const modules = buildModules({ isAdmin, isOperational, canSeeReports, canSeeGestao });
  const currentModule = modules.find((m) =>
    m.prefixes.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))
  );

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
          <Link to="/" className="nav-item nav-item-home" onClick={handleNavClick}>
            <Home size={20} /> Página inicial
          </Link>

          {currentModule && currentModule.items.length > 0 && (
            <>
              <div className="nav-module-label">{currentModule.label}</div>
              {currentModule.items.map(({ to, icon: ItemIcon, label }) => (
                <Link key={to} to={to} className={isActive(to)} onClick={handleNavClick}>
                  <ItemIcon size={20} /> {label}
                </Link>
              ))}
            </>
          )}
        </nav>

      </div>
    </>
  );
};

export default Sidebar;

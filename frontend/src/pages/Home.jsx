import { Link } from 'react-router-dom';
import {
  Ticket, Briefcase, Package, Boxes, Users2, UserSquare2, Wallet,
  Network, ShieldCheck, User, CalendarDays, StickyNote, Scale,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isDepartment } from '../utils/department';
import './styles/Home.css';

// Página inicial (09/09/2026, pedido da Renata): substitui o antigo Dashboard
// em "/" — sem barra lateral, só os blocos de módulo que a pessoa pode abrir
// + os atalhos pessoais (perfil, calendário, organograma, anotações). Cada
// bloco só aparece se o mesmo gate que já protege a rota do módulo autorizar
// — espelha exatamente as checagens de Sidebar.jsx/App.jsx, só que aqui
// decide o que MOSTRAR em vez de bloquear.
const Home = () => {
  const { user, role } = useAuth();

  const isAdmin = role === 'ADMIN';
  const isOperational = ['ADMIN', 'GESTOR_PROJETO', 'CLIENTE', 'COLABORADOR', 'DIRETOR', 'APROVADOR', 'VISUALIZADOR'].includes(role);
  const canSeeGestao = ['ADMIN', 'DIRETOR', 'GESTOR_PROJETO', 'APROVADOR', 'COLABORADOR', 'VISUALIZADOR', 'CLIENTE'].includes(role);
  const canSeeGestaoConsominas = isAdmin || role === 'DIRETOR';
  const dept = (nome) => isAdmin || isDepartment(user?.department, nome);

  const modules = [
    { to: '/tickets', icon: Ticket, label: 'Chamados', show: isOperational },
    { to: '/gestao/projetos', icon: Briefcase, label: 'Projetos', show: canSeeGestao },
    { to: '/gestao/suprimentos', icon: Package, label: 'Suprimentos', show: dept('Suprimentos') },
    { to: '/almoxarifado', icon: Boxes, label: 'Almoxarifado e Patrimônio', show: dept('Almoxarifado') },
    { to: '/rh', icon: Users2, label: 'RH', show: dept('RH') },
    { to: '/departamento-pessoal', icon: UserSquare2, label: 'Departamento Pessoal', show: dept('Departamento Pessoal') },
    // Financeiro (09/09/2026) abre pra todo mundo — qualquer um pode abrir e
    // ver a própria demanda; só quem é do setor Financeiro (ou ADMIN) vê e
    // conclui as de todo mundo (escopo decidido dentro do módulo, não aqui).
    { to: '/financeiro', icon: Wallet, label: 'Financeiro', show: isOperational },
    { to: '/gestao-consominas', icon: Network, label: 'Gestão Consominas', show: canSeeGestaoConsominas },
    { to: '/clientes', icon: ShieldCheck, label: 'Administração do sistema', show: isAdmin },
  ].filter((m) => m.show);

  const quickActions = [
    { to: '/configuracoes', icon: User, label: 'Editar perfil' },
    { to: '/calendario', icon: CalendarDays, label: 'Calendário' },
    { to: '/gestao/organograma', icon: Network, label: 'Organograma' },
    { to: '/anotacoes', icon: StickyNote, label: 'Anotações' },
  ];

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Olá, {user?.name?.split(' ')[0] || 'bem-vindo(a)'}</h1>
        <p>Escolha um módulo pra começar.</p>
      </header>

      <div className="home-modules-grid">
        {modules.map((m) => (
          <Link key={m.to} to={m.to} className="home-module-tile">
            <m.icon size={28} />
            <span>{m.label}</span>
          </Link>
        ))}
      </div>

      <div className="home-quick-actions">
        {quickActions.map((a) => (
          <Link key={a.to} to={a.to} className="home-quick-action">
            <a.icon size={18} />
            <span>{a.label}</span>
          </Link>
        ))}
      </div>

      <footer className="home-footer">
        <Link to="/LGPD"><Scale size={14} /> LGPD</Link>
      </footer>
    </div>
  );
};

export default Home;

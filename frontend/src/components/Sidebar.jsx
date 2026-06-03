import { LayoutDashboard, 
  Ticket, 
  Users, 
  PlusCircle, 
  BarChart3, 
  Building2, 
  BarChart, 
  Scale,
  Tag, 
  UserRoundPen, 
  CircleAlert } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();

  // Função simples para verificar se a rota está ativa e aplicar a classe CSS
  const isActive = (path) => location.pathname === path ? "nav-item active" : "nav-item";

  return (
    
    <div className="sidebar">
      <img src="/public/consominas.jpg" alt="Logo" className="logo" /> 

      <br/>      
      
      <div>
      <nav>
        <Link to="/perfil" className={isActive("/perfil")}>
          <UserRoundPen size={20} /> Perfil
        </Link>

        <Link to="/" className={isActive("/")}>
          <LayoutDashboard size={20} /> Painel Inicial
        </Link>
        
        <Link to="/novo-chamado" className={isActive("/novo-chamado")}>
          <PlusCircle size={20} /> Abrir Chamado
        </Link>
        
        <Link to="/tickets" className={isActive("/tickets")}>
          <Ticket size={20} /> Todos os Chamados
        </Link>

        <Link to="/users" className={isActive("/users")}>
          <Users size={20} /> Usuários
        </Link>

         <Link to="/clientes" className={isActive("/clientes")}>
          <Building2 size={20} /> Clientes
        </Link>             

        <Link to="/categorias" className={isActive("/categorias")}>
          <Tag size={20} /> Categorias
        </Link>

        <Link to="/prioridades" className={isActive("/prioridades")}>
          <CircleAlert size={20} /> Prioridade
        </Link>

        <Link to="/relatorios" className={isActive("/relatorios")}>
          <BarChart size={20} /> Relatórios
        </Link>
        
        <Link to="/LGPD" className={isActive("/LGPD")}>
          <Scale  size={20} /> LGPD
        </Link>

      </nav>
      </div>
    </div>
  );
};

export default Sidebar;
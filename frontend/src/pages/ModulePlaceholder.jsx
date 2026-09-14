import { Construction } from 'lucide-react';
import './styles/ModulePlaceholder.css';

// Tela genérica pros módulos ainda sem conteúdo (Almoxarifado e Patrimônio,
// RH, Departamento Pessoal, Financeiro — 09/09/2026). Cada rota que usa isso
// já tem sua própria restrição por setor em App.jsx; esta tela não decide
// acesso, só avisa que o módulo ainda não tem nada implementado.
const ModulePlaceholder = ({ title }) => (
  <div className="module-placeholder">
    <Construction size={40} />
    <h1>{title}</h1>
    <p>Este módulo ainda está em desenvolvimento — em breve.</p>
  </div>
);

export default ModulePlaceholder;

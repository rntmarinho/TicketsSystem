import React from 'react';
import {
  ShieldCheck,
  Database,
  Lock,
  UserCheck,
  Mail,
  FileText,
  AlertTriangle,
  Scale
} from 'lucide-react';

import './styles/LGPD.css';

const LGPD = () => {
  return (
    <div className="lgpd-page">
      <div className="lgpd-container">

        <div className="lgpd-header">
          <div className="lgpd-badge">
            <ShieldCheck size={18} />
            Adequação LGPD
          </div>

          <h1>Política de Privacidade</h1>

          <p>
            Transparência, segurança e proteção dos seus dados pessoais
            em conformidade com a Lei Geral de Proteção de Dados.
          </p>
        </div>

        <div className="lgpd-grid">

          <section className="lgpd-card">
            <div className="card-icon">
              <FileText size={22} />
            </div>

            <h2>1. Quem somos</h2>

            <p>
              Somos a equipe responsável pelo sistema TicketSystem.
              Esta página descreve como coletamos, utilizamos,
              armazenamos e protegemos dados pessoais.
            </p>
          </section>

          <section className="lgpd-card">
            <div className="card-icon">
              <Database size={22} />
            </div>

            <h2>2. Dados coletados</h2>

            <ul>
              <li>Nome, e-mail e telefone;</li>
              <li>Endereço IP e logs de acesso;</li>
              <li>Informações de dispositivos;</li>
              <li>Histórico de atendimentos e chamados.</li>
            </ul>
          </section>

          <section className="lgpd-card">
            <div className="card-icon">
              <UserCheck size={22} />
            </div>

            <h2>3. Finalidade do tratamento</h2>

            <ul>
              <li>Prestação dos serviços;</li>
              <li>Suporte técnico;</li>
              <li>Melhoria contínua da plataforma;</li>
              <li>Comunicação com usuários.</li>
            </ul>
          </section>

          <section className="lgpd-card">
            <div className="card-icon">
              <Scale size={22} />
            </div>

            <h2>4. Base legal</h2>

            <p>
              O tratamento dos dados ocorre conforme as hipóteses
              previstas na LGPD, incluindo consentimento,
              execução contratual e obrigação legal.
            </p>
          </section>

          <section className="lgpd-card">
            <div className="card-icon">
              <Lock size={22} />
            </div>

            <h2>5. Segurança</h2>

            <p>
              Utilizamos medidas técnicas e organizacionais para
              proteger os dados contra acessos não autorizados,
              perda, alteração ou vazamentos.
            </p>
          </section>

          <section className="lgpd-card">
            <div className="card-icon">
              <AlertTriangle size={22} />
            </div>

            <h2>6. Compartilhamento</h2>

            <p>
              Dados podem ser compartilhados apenas quando
              necessário para prestação dos serviços ou
              cumprimento de exigências legais.
            </p>
          </section>

          <section className="lgpd-card full-width">
            <div className="card-icon">
              <ShieldCheck size={22} />
            </div>

            <h2>7. Direitos do titular</h2>

            <div className="rights-grid">
              <div className="right-item">Acesso aos dados</div>
              <div className="right-item">Correção</div>
              <div className="right-item">Portabilidade</div>
              <div className="right-item">Anonimização</div>
              <div className="right-item">Revogação do consentimento</div>
              <div className="right-item">Exclusão de dados</div>
            </div>
          </section>

          <section className="lgpd-card full-width contact-card">
            <div className="card-icon">
              <Mail size={22} />
            </div>

            <h2>8. Contato</h2>

            <p>
              Em caso de dúvidas ou solicitações relacionadas aos seus dados:
            </p>

            <a href="mailto:renatareismarinho@gmail.com">
              renatareismarinho@gmail.com
            </a>
          </section>

        </div>

        <footer className="lgpd-footer">
          <p>© 2026 TicketSystem • Todos os direitos reservados</p>
          <span>Última atualização: Junho de 2026</span>
        </footer>

      </div>
    </div>
  );
};

export default LGPD;
# 🎫 Sistema de Chamados

Sistema web de gerenciamento de chamados internos — abertura, acompanhamento e resolução de tickets com controle de usuários, categorias, prioridades e relatórios.

---

## 📦 Instalação

### Requisitos

- Windows 10 ou superior
- [Docker Desktop](https://www.docker.com/products/docker-desktop) instalado e em execução
- Conexão com a internet (apenas na primeira instalação, para baixar as imagens)

### Passo a passo

1. Clone o repositório ou copie a pasta do projeto para a máquina
2. Abra o **PowerShell** na pasta do projeto
3. Execute o instalador:

```powershell
.\instalar.ps1
```

> Caso o Windows bloqueie a execução, clique com o botão direito no arquivo → **Executar com PowerShell**, ou rode antes:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

4. Responda as perguntas de configuração (banco de dados, e-mail)
5. Aguarde — o instalador constrói as imagens e sobe o sistema automaticamente
6. Acesse **http://localhost**

O instalador cuida automaticamente de: criação do banco de dados, tabelas, usuário administrador inicial e inicialização de todos os serviços.

---

## ⚙️ Configuração manual (alternativa ao instalador)

Se preferir configurar manualmente, copie o arquivo de exemplo e edite com seus dados:

```bash
cp .env.example .env
```

Principais variáveis:

```env
DB_NAME=helpdeskWS
DB_USER=postgres
DB_PASSWORD=sua_senha

JWT_SECRET_KEY=chave_longa_e_aleatoria

EMAIL_HOST=imap.seuservidor.com.br
EMAIL_USER=suporte@seudominio.com.br
EMAIL_PASSWORD=sua_senha_email

SMTP_HOST=smtp.seuservidor.com.br
SMTP_USER=suporte@seudominio.com.br
SMTP_PASS=sua_senha_email
```

Após configurar o `.env`, suba o sistema:

```bash
docker-compose up --build -d
```

---

## 🚀 Acessando o sistema

| Serviço   | Endereço                  |
|-----------|---------------------------|
| Frontend  | http://localhost          |
| Backend   | http://localhost:5000     |
| Banco     | localhost:5432            |

**Login inicial:**

| Campo  | Valor                  |
|--------|------------------------|
| E-mail | admin@sistema.local    |
| Senha  | Admin@123              |

> ⚠️ Altere a senha do administrador após o primeiro acesso.

---

## 🖥️ Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão geral dos chamados abertos, em andamento e resolvidos |
| **Novo Chamado** | Abertura de ticket com categoria, prioridade e descrição |
| **Todos os Chamados** | Lista completa com filtros e busca |
| **Detalhes do Chamado** | Acompanhamento, comentários e atualização de status |
| **Usuários** | Cadastro e gerenciamento de usuários |
| **Clientes** | Cadastro de clientes vinculados aos chamados |
| **Categorias** | Gerenciamento de categorias |
| **Prioridades** | Configuração de níveis de prioridade e SLA |
| **Relatórios** | Exportação e visualização de métricas |
| **Configurações** | Preferências do sistema (e-mail, SMTP) |

---

## 🐳 Arquitetura Docker

O sistema roda em 3 containers orquestrados pelo Docker Compose:

| Container           | Tecnologia       | Porta |
|---------------------|------------------|-------|
| `tickets_backend`   | Python / Flask   | 5000  |
| `tickets_frontend`  | React + Nginx    | 80    |
| `tickets_db`        | PostgreSQL 16    | 5432  |

O backend executa automaticamente na inicialização:
- Criação do banco de dados (se não existir)
- Criação das tabelas (se não existirem)
- Carga do usuário e cliente administrador padrão

---

## 🗂️ Estrutura do projeto

```
TicketsSystem/
├── backend/
│   ├── Dockerfile
│   ├── main.py            → Ponto de entrada da API
│   ├── requirements.txt
│   ├── seed_admin.py      → Dados iniciais (admin)
│   ├── database/
│   │   └── create_database.py  → Criação do banco e tabelas
│   └── public/anexos/     → Arquivos enviados pelos usuários
├── frontend/
│   ├── Dockerfile
│   └── src/
├── docker-compose.yml     → Orquestração dos serviços
├── instalar.ps1           → Instalador interativo
├── .env.example           → Modelo de configuração
└── .gitignore
```

---

## 🔧 Comandos úteis

```bash
# Subir o sistema
docker-compose up -d

# Parar o sistema
docker-compose down

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f backend

# Reconstruir após mudanças no código
docker-compose up --build -d
```

---

## ❓ Solução de problemas

**O sistema não abre no navegador**
Verifique se os containers estão rodando: `docker-compose ps`

**Erro de conexão com o banco de dados**
Confira as credenciais no `.env` e veja os logs: `docker-compose logs db`

**Backend não inicia / erro no setup**
Veja os logs: `docker-compose logs backend`

**Como reinstalar do zero (apaga todos os dados)**
```bash
docker-compose down -v   # o -v remove também os volumes (banco de dados)
docker-compose up --build -d
```

---

## 📄 Licença

Uso livre.

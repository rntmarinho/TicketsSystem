# 🎫 Tickets System

Sistema web de gerenciamento de chamados internos — abertura, acompanhamento e resolução de tickets com controle de usuários, categorias, prioridades e relatórios.

---

## 📦 Instalação

### Requisitos

- Windows 10 ou superior
- Conexão com a internet (durante a instalação)
- [PostgreSQL](https://www.postgresql.org/download/windows/) instalado e em execução

### Passo a passo

1. Baixe o instalador: **[TicketsSystem_Setup.exe](https://github.com/rntmarinho/TicketsSystem/blob/main/TicketsSystem_Setup.exe)**
2. Execute como **Administrador** (clique com o botão direito → *Executar como administrador*)
3. Siga as instruções na tela — o processo leva alguns minutos pois baixa as dependências automaticamente
4. Ao final, configure o arquivo de variáveis de ambiente (veja seção abaixo)
5. Acesse o sistema em **http://localhost:3000**

> O instalador cuida automaticamente de: Git, Python, Node.js, dependências, build do frontend e registro dos serviços Windows.

---

## ⚙️ Configuração do banco de dados

Após a instalação, edite o arquivo:

```
C:\TicketsSystem\app\backend\.env
```

Preencha com as informações do seu banco PostgreSQL:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ticketsystem
DB_USER=seu_usuario
DB_PASSWORD=sua_senha

SECRET_KEY=troque_por_uma_chave_segura
JWT_SECRET_KEY=troque_por_outra_chave_segura
```

Após salvar o arquivo, reinicie o serviço de backend:

1. Abra o **Gerenciador de Serviços** (`Win + R` → `services.msc`)
2. Localize **Tickets System - Backend**
3. Clique com o botão direito → **Reiniciar**

---

## 🚀 Acessando o sistema

Abra o navegador e acesse:

```
http://localhost:3000
```

Na primeira vez, faça login com as credenciais criadas durante a configuração do banco de dados.

---

## 🖥️ Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão geral dos chamados abertos, em andamento e resolvidos |
| **Novo Chamado** | Abertura de ticket com categoria, prioridade e descrição |
| **Todos os Chamados** | Lista completa com filtros e busca |
| **Detalhes do Chamado** | Acompanhamento, comentários e atualização de status |
| **Usuários** | Cadastro e gerenciamento de usuários do sistema |
| **Clientes** | Cadastro de clientes vinculados aos chamados |
| **Categorias** | Gerenciamento de categorias de chamados |
| **Prioridades** | Configuração de níveis de prioridade |
| **Relatórios** | Exportação e visualização de métricas |
| **Configurações** | Preferências do sistema |
| **LGPD** | Termos e política de privacidade |

---

## 🔧 Serviços Windows

O sistema roda como dois serviços Windows iniciados automaticamente com o Windows:

| Serviço | Descrição | Porta |
|---|---|---|
| `TicketsBackend` | API Flask (Python) | 5000 |
| `TicketsFrontend` | Interface web estática | 3000 |

Para gerenciar os serviços: `Win + R` → `services.msc`

---

## 🗂️ Estrutura de arquivos instalados

```
C:\TicketsSystem\
├── app\
│   ├── backend\       → Código da API (Python/Flask)
│   │   └── .env       → ⚠️ Configurações do banco de dados
│   └── frontend\      → Código-fonte do frontend
├── venv\              → Ambiente virtual Python
├── nssm\              → Gerenciador de serviços
└── logs\
    ├── backend-stdout.log
    ├── backend-stderr.log
    ├── frontend-stdout.log
    └── frontend-stderr.log
```

---

## ❓ Solução de problemas

**O sistema não abre no navegador**
Verifique se os serviços `TicketsBackend` e `TicketsFrontend` estão em execução em `services.msc`.

**Erro de conexão com o banco de dados**
Confira as credenciais no arquivo `C:\TicketsSystem\app\backend\.env` e certifique-se de que o PostgreSQL está rodando.

**Como ver os logs**
Os logs ficam em `C:\TicketsSystem\logs\`. Abra com qualquer editor de texto.

**Como desinstalar**
Painel de Controle → Programas → **Tickets System** → Desinstalar. Os serviços serão removidos automaticamente.

---

## 📄 Licença

Uso livre.

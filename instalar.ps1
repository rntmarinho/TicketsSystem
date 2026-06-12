# ============================================================
#  Instalador do Sistema de Chamados
#  Requer: Docker Desktop instalado e em execução
# ============================================================

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Instalador - Sistema de Chamados" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar se o Docker está instalado e rodando ────────────────────────
Write-Host "Verificando Docker..." -ForegroundColor Yellow

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERRO: Docker não encontrado." -ForegroundColor Red
    Write-Host "Instale o Docker Desktop em: https://www.docker.com/products/docker-desktop" -ForegroundColor Red
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

try {
    docker info | Out-Null
} catch {
    Write-Host ""
    Write-Host "ERRO: Docker está instalado mas não está em execução." -ForegroundColor Red
    Write-Host "Abra o Docker Desktop e aguarde ele iniciar completamente." -ForegroundColor Red
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "Docker OK." -ForegroundColor Green
Write-Host ""

# ── 2. Verificar se já existe um .env configurado ────────────────────────────
$envFile = Join-Path $PSScriptRoot ".env"

if (Test-Path $envFile) {
    Write-Host "Arquivo .env encontrado. Pulando configuração." -ForegroundColor Green
} else {
    Write-Host "Configuração inicial do sistema" -ForegroundColor Yellow
    Write-Host "-------------------------------"
    Write-Host "Responda as perguntas abaixo. Pressione Enter para usar o valor padrão."
    Write-Host ""

    # Banco de dados
    $dbName     = Read-Host "Nome do banco de dados [helpdeskWS]"
    if (-not $dbName) { $dbName = "helpdeskWS" }

    $dbUser     = Read-Host "Usuário do PostgreSQL [postgres]"
    if (-not $dbUser) { $dbUser = "postgres" }

    $dbPassword = Read-Host "Senha do PostgreSQL"
    while (-not $dbPassword) {
        Write-Host "A senha não pode ser vazia." -ForegroundColor Red
        $dbPassword = Read-Host "Senha do PostgreSQL"
    }

    # JWT — gera chave aleatória de 48 caracteres
    $jwtKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object { [char]$_ })

    # E-mail
    Write-Host ""
    Write-Host "Configuração de e-mail (IMAP/SMTP)" -ForegroundColor Yellow

    $emailHost  = Read-Host "Servidor IMAP"
    $emailPort  = Read-Host "Porta IMAP [993]"
    if (-not $emailPort) { $emailPort = "993" }

    $smtpHost   = Read-Host "Servidor SMTP"
    $smtpPort   = Read-Host "Porta SMTP [587]"
    if (-not $smtpPort) { $smtpPort = "587" }

    $emailUser  = Read-Host "E-mail do sistema"
    $emailPass  = Read-Host "Senha do e-mail"

    # Grava o .env
    $envContent = @"
# Gerado pelo instalador em $(Get-Date -Format "dd/MM/yyyy HH:mm")

# Banco de dados
DB_NAME=$dbName
DB_USER=$dbUser
DB_PASSWORD=$dbPassword

# Aplicação
JWT_SECRET_KEY=$jwtKey
JWT_ACCESS_TOKEN_EXPIRES=28800
EMAIL_SERVICE_ENABLED=true

# E-mail IMAP
EMAIL_HOST=$emailHost
EMAIL_PORT=$emailPort
EMAIL_USER=$emailUser
EMAIL_PASSWORD=$emailPass

# E-mail SMTP
SMTP_HOST=$smtpHost
SMTP_PORT=$smtpPort
SMTP_USER=$emailUser
SMTP_PASS=$emailPass
"@

    Set-Content -Path $envFile -Value $envContent -Encoding UTF8
    Write-Host ""
    Write-Host "Arquivo .env criado." -ForegroundColor Green
}

# ── 3. Build e inicialização dos containers ──────────────────────────────────
Write-Host ""
Write-Host "Construindo e iniciando o sistema (isso pode levar alguns minutos)..." -ForegroundColor Yellow
Write-Host ""

Set-Location $PSScriptRoot

docker-compose up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRO: Falha ao iniciar os containers." -ForegroundColor Red
    Write-Host "Verifique os logs com: docker-compose logs" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ── 4. Aguardar o backend ficar disponível ───────────────────────────────────
Write-Host ""
Write-Host "Aguardando o sistema inicializar..." -ForegroundColor Yellow

$tentativas = 0
$maxTentativas = 20

do {
    Start-Sleep -Seconds 3
    $tentativas++
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 3
        if ($resp.StatusCode -eq 200) { break }
    } catch {}
    Write-Host "  Aguardando... ($tentativas/$maxTentativas)"
} while ($tentativas -lt $maxTentativas)

# ── 5. Resultado ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Sistema instalado com sucesso!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost" -ForegroundColor Cyan
Write-Host "  Backend:   http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login inicial:" -ForegroundColor Yellow
Write-Host "    E-mail: admin@sistema.local" -ForegroundColor White
Write-Host "    Senha:  Admin@123" -ForegroundColor White
Write-Host ""
Write-Host "  IMPORTANTE: altere a senha do administrador após o primeiro acesso." -ForegroundColor Red
Write-Host ""

Read-Host "Pressione Enter para sair"

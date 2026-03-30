Write-Host ""
Write-Host "  Atlas - Setup"
Write-Host "  -------------"
Write-Host ""

# ── Prerequisites ──────────────────────────────────────────────────

$missing = @()

if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    $missing += "  - docker (Docker Desktop for Windows)"
}

if ($missing.Count -gt 0) {
    Write-Host "  Missing required tools:" -ForegroundColor Red
    Write-Host ""
    $missing | ForEach-Object { Write-Host $_ }
    Write-Host ""
    Write-Host "  Please install them and try again."
    exit 1
}

# Check Docker daemon
$dockerRunning = $true
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { $dockerRunning = $false }
} catch {
    $dockerRunning = $false
}

if (-not $dockerRunning) {
    Write-Host "  Error: Docker daemon is not running." -ForegroundColor Red
    Write-Host "  Please start Docker Desktop and try again."
    exit 1
}

# Check we're in the right directory
if (-not (Test-Path "docker-compose.production.yml")) {
    Write-Host "  Error: docker-compose.production.yml not found." -ForegroundColor Red
    Write-Host "  Please run this script from the Atlas project root."
    exit 1
}

if (-not (Test-Path ".env.example")) {
    Write-Host "  Error: .env.example not found." -ForegroundColor Red
    Write-Host "  Please run this script from the Atlas project root."
    exit 1
}

# Check port 3001
$portInUse = $false
try {
    $conn = New-Object System.Net.Sockets.TcpClient
    $conn.Connect("127.0.0.1", 3001)
    $conn.Close()
    $portInUse = $true
} catch {}

if ($portInUse) {
    Write-Host "  Warning: Port 3001 is already in use." -ForegroundColor Yellow
    Write-Host "  Atlas needs this port. Stop the other process or change PORT in .env."
    Write-Host ""
}

Write-Host "  Prerequisites: OK"
Write-Host ""

# ── Generate .env ──────────────────────────────────────────────────

if (-not (Test-Path ".env")) {
    Write-Host "  [1/3] Generating secrets..."
    Copy-Item ".env.example" ".env"

    function New-Secret {
        $bytes = New-Object byte[] 32
        [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
        return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    }

    $jwt = New-Secret
    $refresh = New-Secret
    $encryption = New-Secret

    (Get-Content ".env") `
        -replace "^JWT_SECRET=CHANGE_ME$", "JWT_SECRET=$jwt" `
        -replace "^JWT_REFRESH_SECRET=CHANGE_ME$", "JWT_REFRESH_SECRET=$refresh" `
        -replace "^TOKEN_ENCRYPTION_KEY=CHANGE_ME$", "TOKEN_ENCRYPTION_KEY=$encryption" |
        Set-Content ".env"

    Write-Host "         Done. Secrets written to .env"
} else {
    Write-Host "  [1/3] Using existing .env file"
}

# ── Build and start ────────────────────────────────────────────────

Write-Host "  [2/3] Building and starting containers (first run may take a few minutes)..."
Write-Host ""

docker compose -f docker-compose.production.yml up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  Error: Docker build failed." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Common fixes:"
    Write-Host "    - Make sure Docker Desktop has enough memory (4GB+ recommended)"
    Write-Host "    - Try again: docker compose -f docker-compose.production.yml up -d --build"
    Write-Host ""
    exit 1
}

Write-Host ""

# ── Health check ───────────────────────────────────────────────────

Write-Host "  [3/3] Waiting for Atlas to be ready..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host ""

if ($ready) {
    Write-Host "  Atlas is running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Open http://localhost:3001 to get started."
    Write-Host "  You'll create your admin account on first visit."
    Write-Host ""
    Write-Host "  Useful commands:"
    Write-Host "    View logs:     docker compose -f docker-compose.production.yml logs -f atlas"
    Write-Host "    Stop:          docker compose -f docker-compose.production.yml down"
    Write-Host "    Restart:       docker compose -f docker-compose.production.yml restart atlas"
    Write-Host ""
} else {
    Write-Host "  Atlas didn't respond in time." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Check the logs:"
    Write-Host "    docker compose -f docker-compose.production.yml logs atlas"
    Write-Host ""
    exit 1
}

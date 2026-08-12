param(
    [string]$ProjectName = "ticsol-frontend",
    [string]$RepoRoot = (Get-Location).Path
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TicSol Logistics Hub - Frontend Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Criando projeto React/Vite..." -ForegroundColor Yellow
npm create vite@latest $ProjectName -- --template react

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao criar projeto Vite" -ForegroundColor Red
    exit 1
}

cd $ProjectName
Write-Host "OK - Projeto criado em: $(Get-Location)" -ForegroundColor Green
Write-Host ""

Write-Host "2. Instalando dependencias..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao instalar" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Dependencias instaladas" -ForegroundColor Green
Write-Host ""

Write-Host "3. Copiando componentes..." -ForegroundColor Yellow

$src = Join-Path $RepoRoot "frontend"

New-Item -ItemType Directory -Path "src/components" -Force | Out-Null
New-Item -ItemType Directory -Path "src/styles" -Force | Out-Null

Copy-Item "$src/receção" -Destination "src/components/" -Recurse -Force
Write-Host "  OK - Receção copiada" -ForegroundColor Green

Copy-Item "$src/paletizacao" -Destination "src/components/" -Recurse -Force
Write-Host "  OK - Paletizacao copiada" -ForegroundColor Green

Copy-Item "$src/shared/tokens.css" -Destination "src/styles/" -Force
Write-Host "  OK - tokens.css copiado" -ForegroundColor Green

Write-Host ""

Write-Host "4. Configurando App.jsx..." -ForegroundColor Yellow
Copy-Item "$src/App.jsx.example" -Destination "src/App.jsx" -Force
Copy-Item "$src/App.css.example" -Destination "src/App.css" -Force
Write-Host "  OK - App.jsx e App.css criados" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OK - Setup concluido!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor Cyan
Write-Host "  Abre http://localhost:5173" -ForegroundColor Cyan

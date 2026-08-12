# Setup script para frontend React/Vite
# Uso: .\setup-frontend.ps1

param(
    [string]$ProjectName = "ticsol-frontend",
    [string]$RepoRoot = (Get-Location).Path
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TicSol Logistics Hub - Frontend Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Criar projeto Vite
Write-Host "1. Criando projeto React/Vite..." -ForegroundColor Yellow
npm create vite@latest $ProjectName -- --template react

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao criar projeto Vite" -ForegroundColor Red
    exit 1
}

cd $ProjectName
Write-Host "✓ Projeto criado em: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# 2. Instalar dependências
Write-Host "2. Instalando dependências..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao instalar dependências" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependências instaladas" -ForegroundColor Green
Write-Host ""

# 3. Copiar componentes
Write-Host "3. Copiando componentes..." -ForegroundColor Yellow

$src = Join-Path $RepoRoot "frontend"

# Criar pastas se não existirem
New-Item -ItemType Directory -Path "src/components" -Force | Out-Null
New-Item -ItemType Directory -Path "src/styles" -Force | Out-Null

# Copiar receção
Copy-Item "$src/receção" -Destination "src/components/" -Recurse -Force
Write-Host "  ✓ Receção copiada" -ForegroundColor Green

# Copiar paletização
Copy-Item "$src/paletizacao" -Destination "src/components/" -Recurse -Force
Write-Host "  ✓ Paletização copiada" -ForegroundColor Green

# Copiar tokens.css
Copy-Item "$src/shared/tokens.css" -Destination "src/styles/" -Force
Write-Host "  ✓ tokens.css copiado" -ForegroundColor Green

Write-Host ""

# 4. Copiar App.jsx e App.css
Write-Host "4. Configurando App.jsx..." -ForegroundColor Yellow
Copy-Item "$src/App.jsx.example" -Destination "src/App.jsx" -Force
Copy-Item "$src/App.css.example" -Destination "src/App.css" -Force
Write-Host "  ✓ App.jsx e App.css criados" -ForegroundColor Green
Write-Host ""

# 5. Resumo
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Setup concluído!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. Certifica que PostgreSQL + PostgREST estão a correr"
Write-Host "  2. Edita src/components/receção/api/postgrestClient.js se necessário"
Write-Host "  3. Edita src/components/paletizacao/api/paletizacaoClient.js se necessário"
Write-Host "  4. Arranca o dev server:"
Write-Host ""
Write-Host "     npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Abre http://localhost:5173 no browser" -ForegroundColor Cyan

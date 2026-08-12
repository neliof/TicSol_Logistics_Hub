# Script para aplicar todas as migrações PostgreSQL

$env:PATH += ";C:\Program Files\PostgreSQL\18\bin"
$dbname = "ticsol_logistics_hub"

Write-Host "Aplicando migrações PostgreSQL..." -ForegroundColor Cyan
Write-Host ""

$migrations = @(
    "database/01_schema.sql",
    "database/02_security.sql",
    "database/03_functions_rpc.sql",
    "database/04_regras_sonae_mc.sql",
    "database/05_simulacao_dados_ficticios.sql",
    "database/06_artsoft_sync_staging.sql"
)

foreach ($migration in $migrations) {
    Write-Host "Aplicando $migration..." -ForegroundColor Yellow
    psql -d $dbname -f $migration

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Sucesso" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Erro!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✓ Todas as migrações aplicadas!" -ForegroundColor Green

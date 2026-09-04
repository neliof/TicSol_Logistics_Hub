$env:ARTSOFT_HOST = "192.168.1.120"
$env:ARTSOFT_PORTA = "4333"
$env:ARTSOFT_UTILIZADOR = "ADMIN"
$env:ARTSOFT_SENHA = "ARTSOFT"
$env:ARTSOFT_URL = "http://$($env:ARTSOFT_HOST):$($env:ARTSOFT_PORTA)/Queries/Query"

Write-Host "Credenciais carregadas:" -ForegroundColor Cyan
Write-Host "Host: $($env:ARTSOFT_HOST):$($env:ARTSOFT_PORTA)" -ForegroundColor Gray

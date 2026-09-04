. "$PSScriptRoot\credenciais.ps1"

Write-Host ""
Write-Host "=== Teste Conexao ===" -ForegroundColor Green

# Ping
try {
  $ping = Test-Connection -ComputerName $env:ARTSOFT_HOST -Count 1 -ErrorAction Stop
  Write-Host "[OK] Ping OK - $($ping.ResponseTime)ms" -ForegroundColor Green
} catch {
  Write-Host "[ERRO] Ping falhou: $_" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== Teste Digest Auth (via curl) ===" -ForegroundColor Green

$body = @"
<?xml version="1.0"?>
<root type="list" name="test" query="DocFch|V980|NrDoc=1:1">
  <defcol>
    <DocNrDoc form="%DocFch.Doc.NrDoc"/>
    <DocSerie form="%DocFch.Doc.Serie"/>
  </defcol>
</root>
"@

$tempBody = "$PSScriptRoot\..\e2e-artsoft\temp-request.xml"
New-Item -ItemType Directory -Path "$PSScriptRoot\..\e2e-artsoft" -Force | Out-Null
$body | Out-File -FilePath $tempBody -Encoding UTF8 -NoNewline

try {
  $outputPath = "$PSScriptRoot\..\e2e-artsoft\test-auth.xml"

  # Usar curl nativo do Windows 10
  $curlCmd = @(
    "curl",
    "-v",
    "--digest",
    "-u", "$($env:ARTSOFT_UTILIZADOR):$($env:ARTSOFT_SENHA)",
    "-X", "POST",
    "$env:ARTSOFT_URL",
    "-H", "Content-Type: application/xml",
    "-d", "@$tempBody",
    "-o", $outputPath
  )

  $curlOutput = & $curlCmd 2>&1

  if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Auth OK - curl exitcode: $LASTEXITCODE" -ForegroundColor Green
    Write-Host "[OK] Resposta salva em: $outputPath" -ForegroundColor Green

    Write-Host ""
    Write-Host "Primeiras 60 linhas da resposta:" -ForegroundColor Cyan
    ($curlOutput + (Get-Content $outputPath)) | Select-Object -First 60 | ForEach-Object { Write-Host $_ }

  } else {
    Write-Host "[ERRO] curl falhou com exitcode: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Output: $curlOutput" -ForegroundColor Red
    exit 1
  }

} catch {
  Write-Host "[ERRO] $_" -ForegroundColor Red
  exit 1
} finally {
  Remove-Item -Path $tempBody -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "[OK] Conexao e autenticacao validadas com sucesso!" -ForegroundColor Green

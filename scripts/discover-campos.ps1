. "$PSScriptRoot\credenciais.ps1"

Write-Host ""
Write-Host "=== Descobrir Campos Cabecalho (DocFch) ===" -ForegroundColor Green
Write-Host "Query: DocFch|V980|NrDoc=1:20" -ForegroundColor Gray

$body = @"
<?xml version="1.0"?>
<root type="list" name="DocFch" query="DocFch|V980|NrDoc=1:20">
  <defcol>
    <DocSerie form="%DocFch.Doc.Serie"/>
    <DocNrDoc form="%DocFch.Doc.NrDoc"/>
    <DataDocum form="%DocFch.Doc.DataDocum"/>
    <TpSAFT form="%DocFch.Inf.TpSAFT"/>
    <TerTerceiro form="%DocFch.Ter.Terceiro"/>
    <TerNome form="%DocFch.Ter.Nome"/>
    <TerNIF form="%DocFch.Ter.NIF"/>
    <Matricula form="%DocFch.Logis.Matricula"/>
    <EndCarga form="%DocFch.Logis.EndCarga"/>
    <EndDescarga form="%DocFch.Logis.EndDescarga"/>
    <Peso form="%DocFch.Logis.Peso"/>
    <Volumes form="%DocFch.Logis.Volumes"/>
    <DataHora form="%DocFch.Logis.DataHora"/>
  </defcol>
</root>
"@

$tempBody = "$PSScriptRoot\..\e2e-artsoft\temp-request.xml"
New-Item -ItemType Directory -Path "$PSScriptRoot\..\e2e-artsoft" -Force | Out-Null
$body | Out-File -FilePath $tempBody -Encoding UTF8 -NoNewline

try {
  $outputPath = "$PSScriptRoot\..\e2e-artsoft\docfch-response.xml"

  # Usar curl nativo do Windows 10
  $curlCmd = @(
    "curl",
    "-s",
    "--digest",
    "-u", "$($env:ARTSOFT_UTILIZADOR):$($env:ARTSOFT_SENHA)",
    "-X", "POST",
    "$env:ARTSOFT_URL",
    "-H", "Content-Type: application/xml",
    "-d", "@$tempBody",
    "-o", $outputPath
  )

  & $curlCmd 2>&1 | Out-Null

  if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Resposta salva em: $outputPath" -ForegroundColor Green

    $content = Get-Content $outputPath -Raw
    Write-Host ""
    Write-Host "Tamanho: $($content.Length) bytes" -ForegroundColor Gray

    Write-Host ""
    Write-Host "Primeiras 150 linhas:" -ForegroundColor Cyan
    ($content -split "`n")[0..149] | ForEach-Object { Write-Host $_ }

    Write-Host ""
    Write-Host "=== Analise Rapida ===" -ForegroundColor Yellow

    # Verificar se tem dados
    if ($content -match "<Matricula>[^<]*[A-Za-z0-9]") {
      Write-Host "[OK] Matricula: tem dados" -ForegroundColor Green
    } elseif ($content -match "<Matricula>") {
      Write-Host "[!] Matricula: campo existe mas vazio" -ForegroundColor Yellow
    } else {
      Write-Host "[!] Matricula: NAO encontrada" -ForegroundColor Yellow
    }

    if ($content -match "<EndCarga>[^<]*[A-Za-z0-9]") {
      Write-Host "[OK] EndCarga: tem dados" -ForegroundColor Green
    } elseif ($content -match "<EndCarga>") {
      Write-Host "[!] EndCarga: campo existe mas vazio" -ForegroundColor Yellow
    } else {
      Write-Host "[!] EndCarga: NAO encontrada" -ForegroundColor Yellow
    }

    if ($content -match "<EndDescarga>[^<]*[A-Za-z0-9]") {
      Write-Host "[OK] EndDescarga: tem dados" -ForegroundColor Green
    } elseif ($content -match "<EndDescarga>") {
      Write-Host "[!] EndDescarga: campo existe mas vazio" -ForegroundColor Yellow
    } else {
      Write-Host "[!] EndDescarga: NAO encontrada" -ForegroundColor Yellow
    }

    if ($content -match "<Peso>[^<]*[0-9]") {
      Write-Host "[OK] Peso: tem dados" -ForegroundColor Green
    } elseif ($content -match "<Peso>") {
      Write-Host "[!] Peso: campo existe mas vazio" -ForegroundColor Yellow
    } else {
      Write-Host "[!] Peso: NAO encontrada" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "[OK] Descoberta de campos concluida!" -ForegroundColor Green

  } else {
    Write-Host "[ERRO] curl falhou com exitcode: $LASTEXITCODE" -ForegroundColor Red
    exit 1
  }

} catch {
  Write-Host "[ERRO] $_" -ForegroundColor Red
  exit 1
} finally {
  Remove-Item -Path $tempBody -Force -ErrorAction SilentlyContinue
}

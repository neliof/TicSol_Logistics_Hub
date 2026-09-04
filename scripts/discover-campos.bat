@echo off
setlocal enabledelayedexpansion

echo.
echo === Descobrir Campos Cabecalho (DocFch) ===

REM Criar directorio se nao existir
if not exist "..\e2e-artsoft" mkdir ..\e2e-artsoft

REM Criar ficheiro temporario com XML
(
echo ^<?xml version="1.0"?^>
echo ^<root type="list" name="DocFch" query="DocFch"^>
echo   ^<defcol^>
echo     ^<DocSerie form="%%DocFch.Doc.Serie"/^>
echo     ^<DocNrDoc form="%%DocFch.Doc.NrDoc"/^>
echo     ^<DataDocum form="%%DocFch.Doc.DataDocum"/^>
echo     ^<TpSAFT form="%%DocFch.Inf.TpSAFT"/^>
echo     ^<TerTerceiro form="%%DocFch.Ter.Terceiro"/^>
echo     ^<TerNome form="%%DocFch.Ter.Nome"/^>
echo     ^<Matricula form="%%DocFch.Logis.Matricula"/^>
echo     ^<EndCarga form="%%DocFch.Logis.EndCarga"/^>
echo     ^<EndDescarga form="%%DocFch.Logis.EndDescarga"/^>
echo     ^<Peso form="%%DocFch.Logis.Peso"/^>
echo     ^<Volumes form="%%DocFch.Logis.Volumes"/^>
echo     ^<DataHora form="%%DocFch.Logis.DataHora"/^>
echo   ^</defcol^>
echo ^</root^>
) > ..\e2e-artsoft\temp-request.xml

echo [OK] Ficheiro XML criado
echo.
type ..\e2e-artsoft\temp-request.xml
echo.

REM Executar curl com --data-binary
echo [INFO] Enviando request para ARTSOFT...
curl -s --digest -u ADMIN:ARTSOFT --data-binary @..\e2e-artsoft\temp-request.xml -H "Content-Type: application/xml" http://192.168.1.120:4333/Queries/Query -o ..\e2e-artsoft\docfch-response.xml 2>&1

if %ERRORLEVEL% equ 0 (
  echo [OK] Resposta recebida

  REM Mostrar tamanho
  for %%A in (..\e2e-artsoft\docfch-response.xml) do (
    if %%~zA gtr 100 (
      echo Tamanho: %%~zA bytes
    ) else (
      echo [!] Tamanho pequeno: %%~zA bytes
    )
  )

  echo.
  echo === Resposta Completa ===
  type ..\e2e-artsoft\docfch-response.xml

  echo.
  echo === Analise ===

  REM Verificar campos
  findstr /I "Matricula\|EndCarga\|Peso" ..\e2e-artsoft\docfch-response.xml >nul
  if !ERRORLEVEL! equ 0 (
    echo [OK] Campos logisticos encontrados na resposta
  ) else (
    echo [!] Nenhum campo logistico encontrado
  )

) else (
  echo [ERRO] curl falhou
  type ..\e2e-artsoft\docfch-response.xml
  exit /b 1
)

del ..\e2e-artsoft\temp-request.xml
echo.
echo [OK] Descricao concluida

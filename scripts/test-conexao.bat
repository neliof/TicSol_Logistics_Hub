@echo off
setlocal enabledelayedexpansion

echo.
echo === Teste Conexao ===

REM Testar ping
ping -n 1 192.168.1.120 >nul 2>&1
if %ERRORLEVEL% equ 0 (
  echo [OK] Ping OK
) else (
  echo [ERRO] Ping falhou
  exit /b 1
)

echo.
echo === Teste Digest Auth (via curl) ===

REM Criar directorio se nao existir
if not exist "..\e2e-artsoft" mkdir ..\e2e-artsoft

REM Criar ficheiro XML
(
echo ^<?xml version="1.0"?^>
echo ^<root type="list" name="test" query="DocFch"^>
echo   ^<defcol^>
echo     ^<DocNrDoc form="%%DocFch.Doc.NrDoc"/^>
echo   ^</defcol^>
echo ^</root^>
) > ..\e2e-artsoft\temp-request.xml

echo [OK] Ficheiro XML criado
type ..\e2e-artsoft\temp-request.xml
echo.

REM Executar curl com --data-binary
echo [INFO] Enviando request...
curl -v --digest -u ADMIN:ARTSOFT --data-binary @..\e2e-artsoft\temp-request.xml -H "Content-Type: application/xml" http://192.168.1.120:4333/Queries/Query -o ..\e2e-artsoft\test-auth.xml 2>&1

if %ERRORLEVEL% equ 0 (
  echo.
  echo [OK] Resposta salva
  type ..\e2e-artsoft\test-auth.xml
) else (
  echo.
  echo [ERRO] curl falhou
  type ..\e2e-artsoft\test-auth.xml
  exit /b 1
)

del ..\e2e-artsoft\temp-request.xml
echo.
echo [OK] Teste concluido

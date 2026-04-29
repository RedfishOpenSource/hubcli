@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "HUBCLI_HOME=%SCRIPT_DIR%"
if not defined PLAYWRIGHT_BROWSERS_PATH set "PLAYWRIGHT_BROWSERS_PATH=%HUBCLI_HOME%ms-playwright"
set "HUBCLI_PACKAGED=1"
"%HUBCLI_HOME%runtime\node\node.exe" "%HUBCLI_HOME%bin\hubcli.js" %*

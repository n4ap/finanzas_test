@echo off
rem Descarga la ultima version y abre Life Dashboard. Cierra antes la ventana de la app si esta abierta.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\iniciar.ps1" -Actualizar

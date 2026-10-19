# Crea el icono «Life Dashboard» en el escritorio (apunta a Iniciar.bat).
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$desk = [Environment]::GetFolderPath('Desktop')
$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut((Join-Path $desk 'Life Dashboard.lnk'))
$lnk.TargetPath = Join-Path $Root 'Iniciar.bat'
$lnk.WorkingDirectory = "$Root"
$lnk.IconLocation = (Join-Path $Root 'scripts\windows\life-dashboard.ico') + ',0'
$lnk.Description = 'Abrir Life Dashboard'
$lnk.Save()
Write-Host "Listo: tienes el icono «Life Dashboard» en el escritorio ($desk)." -ForegroundColor Green
Read-Host 'Pulsa Enter para cerrar'

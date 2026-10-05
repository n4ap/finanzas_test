# Arranca Life Dashboard en Windows: Docker + base de datos + copia diaria + compilación si hay versión nueva + servidor + navegador.
# Se lanza con «Iniciar.bat» (doble clic). Cerrar la ventana apaga la app.
param([switch]$Actualizar)

$ErrorActionPreference = 'Continue'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $Root
$Host.UI.RawUI.WindowTitle = 'Life Dashboard - no cierres esta ventana (minimizala)'
$Port = 3000
$Url = "http://localhost:$Port"

function Paso($m) { Write-Host "-> $m" -ForegroundColor Cyan }
function Fallo($m) {
  Write-Host ""
  Write-Host "ERROR: $m" -ForegroundColor Red
  Write-Host "Haz una captura de esta ventana y enviasela a Claude." -ForegroundColor Yellow
  Read-Host 'Pulsa Enter para cerrar'
  exit 1
}
function Responde { try { Invoke-WebRequest "$Url/login" -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true } catch { return $false } }

# 1) ¿Ya está abierta? Entonces solo se abre el navegador (salvo si se pide actualizar).
if (Responde) {
  if ($Actualizar) { Fallo 'La app ya esta en marcha. Cierra su ventana negra y vuelve a ejecutar «Actualizar».' }
  Start-Process $Url
  exit 0
}

# 2) Programas necesarios
foreach ($c in 'node', 'npm', 'git', 'docker') {
  if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { Fallo "No se encuentra '$c'. Instala Node.js, Git y Docker Desktop (ver README) y reinicia el PC." }
}

# 3) Actualizar el código si se pidió
if ($Actualizar) {
  Paso 'Descargando la ultima version...'
  git pull
  if ($LASTEXITCODE -ne 0) { Fallo 'No se pudo descargar la actualizacion (git pull).' }
}

# 4) Docker Desktop
Paso 'Comprobando Docker...'
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dd) { Start-Process $dd }
  Paso 'Arrancando Docker Desktop (puede tardar un par de minutos)...'
  $ok = $false
  for ($i = 0; $i -lt 90; $i++) { Start-Sleep -Seconds 2; docker info *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true; break } }
  if (-not $ok) { Fallo 'Docker no arranca. Abre Docker Desktop a mano, espera a que este en verde y vuelve a intentarlo.' }
}

# 5) Base de datos
Paso 'Arrancando la base de datos...'
docker start lifedash-pg *> $null
if ($LASTEXITCODE -ne 0) { Fallo 'No existe la base de datos «lifedash-pg». Crea el contenedor con el comando «docker run» del README.' }
$ok = $false
for ($i = 0; $i -lt 30; $i++) { docker exec lifedash-pg pg_isready -U lifedash *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true; break }; Start-Sleep -Seconds 1 }
if (-not $ok) { Fallo 'La base de datos no responde.' }

# 6) Copia completa de la base de datos, una al día (se conservan 14)
$bk = Join-Path $Root 'backups\base-de-datos'
New-Item -ItemType Directory -Force -Path $bk | Out-Null
$dest = Join-Path $bk ('lifedash-{0}.sql' -f (Get-Date -Format 'yyyy-MM-dd'))
if (-not (Test-Path $dest)) {
  Paso 'Guardando la copia de seguridad del dia...'
  docker exec lifedash-pg pg_dump -U lifedash -d lifedash -f /tmp/lifedash.sql
  if ($LASTEXITCODE -eq 0) { docker cp lifedash-pg:/tmp/lifedash.sql $dest *> $null }
  if (-not (Test-Path $dest)) { Write-Host '   Aviso: no se pudo guardar la copia de hoy (la app arranca igualmente).' -ForegroundColor Yellow }
  Get-ChildItem $bk -Filter 'lifedash-*.sql' | Sort-Object Name -Descending | Select-Object -Skip 14 | Remove-Item -Force
}

# 7) Preparar la versión instalada (solo si el código cambió desde la última vez)
$head = (git rev-parse HEAD).Trim()
$stamp = Join-Path $Root '.next\lifedash-head.txt'
$listo = (Test-Path (Join-Path $Root '.next\BUILD_ID')) -and (Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $head)
if (-not $listo) {
  Paso 'Preparando la version nueva (solo tras instalar o actualizar; tarda unos minutos)...'
  npm install --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { Fallo 'Fallo «npm install».' }
  # Sin teclado conectado (entrada vacía), Prisma se niega a aplicar un cambio que borre datos en lugar de preguntar.
  $null | npx prisma db push --skip-generate
  if ($LASTEXITCODE -ne 0) { Fallo 'La base de datos necesita un cambio que podria borrar datos. No se ha tocado nada.' }
  npm run build
  if ($LASTEXITCODE -ne 0) { Fallo 'Fallo la compilacion («npm run build»).' }
  Set-Content -Path $stamp -Value $head
}

# 8) Abrir el navegador cuando el servidor responda (en segundo plano) y arrancar
Start-Job -ArgumentList $Url -ScriptBlock {
  param($u)
  for ($i = 0; $i -lt 90; $i++) {
    try { Invoke-WebRequest "$u/login" -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $u; return } catch { Start-Sleep -Seconds 1 }
  }
} | Out-Null

Write-Host ''
Write-Host "Life Dashboard se esta abriendo en $Url" -ForegroundColor Green
Write-Host 'Minimiza esta ventana. Si la cierras, la app se apaga.' -ForegroundColor Green
Write-Host ''
npx next start -p $Port
Read-Host 'La app se ha detenido. Pulsa Enter para cerrar'

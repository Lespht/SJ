#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instala "Nosotros" (PocketBase) como servidor en Windows.

.DESCRIPTION
    1. Descarga pocketbase.exe (version fija) y verifica su SHA-256.
    2. Copia pb_migrations y pb_public desde este repositorio.
    3. (Opcional) Copia datos existentes (pb_data) desde otra carpeta.
    4. Crea una regla del Firewall que solo permite el puerto desde Meshnet (100.64.0.0/10).
    5. Crea una tarea programada que arranca PocketBase al iniciar Windows
       (sin necesidad de iniciar sesion) y lo reinicia si falla.
    6. Desactiva la suspension/hibernacion cuando esta enchufado.

    Se puede volver a ejecutar sin problema (para actualizar el frontend o PocketBase).
    Los datos en <Destino>\pb_data nunca se borran.

.EXAMPLE
    # PowerShell como Administrador, desde la carpeta server\windows del repo:
    powershell -ExecutionPolicy Bypass -File .\instalar.ps1

.EXAMPLE
    # Igual, pero trayendo los datos del servidor de prueba (fotos, usuarios, etc.):
    powershell -ExecutionPolicy Bypass -File .\instalar.ps1 -DatosDesde "D:\backup\pb_data"

.EXAMPLE
    # Quitar tarea y regla de firewall (NO borra los datos):
    powershell -ExecutionPolicy Bypass -File .\instalar.ps1 -Desinstalar
#>
param(
    [string]$Destino = "C:\Nosotros",
    [string]$Version = "0.40.6",
    [int]$Puerto = 8090,
    [string]$DatosDesde = "",
    [switch]$Desinstalar
)

$ErrorActionPreference = "Stop"
$NombreTarea = "Nosotros (PocketBase)"
$NombreRegla = "Nosotros - PocketBase (Meshnet)"
$RangoMeshnet = "100.64.0.0/10"

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }

# ---------------------------------------------------------------- desinstalar
if ($Desinstalar) {
    Paso "Deteniendo y quitando la tarea programada"
    Stop-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $NombreTarea -Confirm:$false -ErrorAction SilentlyContinue
    Paso "Quitando la regla del firewall"
    Get-NetFirewallRule -DisplayName $NombreRegla -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Host "`nListo. Los archivos en $Destino (incluidos los datos) se mantienen." -ForegroundColor Green
    exit 0
}

$Repo = Resolve-Path (Join-Path $PSScriptRoot "..")   # carpeta server\ del repo
$Exe = Join-Path $Destino "pocketbase.exe"

# ---------------------------------------------------------------- comprobaciones
$PublicOrigen = Join-Path $Repo "pb_public"
if (-not (Test-Path (Join-Path $PublicOrigen "index.html"))) {
    throw "No existe server\pb_public\index.html. Compila el frontend antes (cd web; pnpm build) y copia la carpeta server\pb_public."
}

New-Item -ItemType Directory -Force -Path $Destino | Out-Null

# Si ya estaba corriendo, detenerlo para poder reemplazar archivos.
if (Get-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue) {
    Paso "Deteniendo la instancia actual"
    Stop-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue
}
Get-Process -Name pocketbase -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $Exe } | Stop-Process -Force
Start-Sleep -Seconds 1

# ---------------------------------------------------------------- 1. PocketBase
$versionActual = if (Test-Path $Exe) { (& $Exe --version) -replace '.*version\s+', '' } else { "" }
if ($versionActual -ne $Version) {
    Paso "Descargando PocketBase v$Version"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $base = "https://github.com/pocketbase/pocketbase/releases/download/v$Version"
    $zipNombre = "pocketbase_${Version}_windows_amd64.zip"
    $tmp = Join-Path $env:TEMP "nosotros-pb"
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $zip = Join-Path $tmp $zipNombre
    Invoke-WebRequest "$base/$zipNombre" -OutFile $zip -UseBasicParsing
    $checksums = (Invoke-WebRequest "$base/checksums.txt" -UseBasicParsing).Content

    $esperado = ($checksums -split "`n" | Where-Object { $_ -match [regex]::Escape($zipNombre) }) -replace '\s.*', ''
    $real = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
    if (-not $esperado -or $real -ne $esperado.Trim().ToLower()) {
        throw "El SHA-256 no coincide (esperado '$esperado', obtenido '$real'). Se cancela."
    }
    Write-Host "    SHA-256 verificado"

    Expand-Archive $zip -DestinationPath $tmp -Force
    Copy-Item (Join-Path $tmp "pocketbase.exe") $Exe -Force
    Remove-Item $tmp -Recurse -Force
} else {
    Paso "PocketBase v$Version ya instalado"
}

# ---------------------------------------------------------------- 2. migraciones + frontend
Paso "Copiando migraciones y frontend"
foreach ($carpeta in "pb_migrations", "pb_public") {
    $dst = Join-Path $Destino $carpeta
    if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }   # se regeneran desde el repo
    Copy-Item (Join-Path $Repo $carpeta) $dst -Recurse
}

# ---------------------------------------------------------------- 3. datos existentes (opcional)
$Datos = Join-Path $Destino "pb_data"
if ($DatosDesde) {
    if (-not (Test-Path (Join-Path $DatosDesde "data.db"))) { throw "No hay data.db en '$DatosDesde'." }
    if (Test-Path (Join-Path $Datos "data.db")) {
        $respaldo = "$Datos.antes-" + (Get-Date -Format "yyyyMMdd-HHmmss")
        Paso "Ya habia datos: se mueven a $respaldo"
        Move-Item $Datos $respaldo
    }
    Paso "Copiando datos desde $DatosDesde"
    Copy-Item $DatosDesde $Datos -Recurse
}

Paso "Aplicando migraciones"
& $Exe migrate up --dir $Datos --migrationsDir (Join-Path $Destino "pb_migrations")
if ($LASTEXITCODE -ne 0) { throw "Fallo 'migrate up'." }

# ---------------------------------------------------------------- 4. firewall
Paso "Firewall: puerto $Puerto solo desde Meshnet ($RangoMeshnet)"
Get-NetFirewallRule -DisplayName $NombreRegla -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $NombreRegla -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Puerto -RemoteAddress $RangoMeshnet -Profile Any `
    -Program $Exe | Out-Null

# ---------------------------------------------------------------- 5. tarea de inicio
Paso "Tarea programada: arrancar con Windows"
$argumentos = @(
    "serve", "--http", "0.0.0.0:$Puerto",
    "--dir", "`"$Datos`"",
    "--migrationsDir", "`"$(Join-Path $Destino 'pb_migrations')`"",
    "--publicDir", "`"$(Join-Path $Destino 'pb_public')`""
) -join " "

$accion = New-ScheduledTaskAction -Execute $Exe -Argument $argumentos -WorkingDirectory $Destino
$disparador = New-ScheduledTaskTrigger -AtStartup
$usuario = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$ajustes = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $NombreTarea -Action $accion -Trigger $disparador `
    -Principal $usuario -Settings $ajustes -Force | Out-Null
Start-ScheduledTask -TaskName $NombreTarea

# ---------------------------------------------------------------- 6. energia
Paso "Energia: no suspender ni hibernar enchufado"
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

# ---------------------------------------------------------------- comprobacion
Paso "Comprobando que responde"
$ok = $false
for ($i = 0; $i -lt 10 -and -not $ok; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest "http://127.0.0.1:$Puerto/api/health" -UseBasicParsing -TimeoutSec 2
        $ok = $r.StatusCode -eq 200
    } catch { }
}
if (-not $ok) {
    throw "PocketBase no responde en el puerto $Puerto. Revisa: Programador de tareas > '$NombreTarea' > Historial."
}

$ipMeshnet = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like "100.*" } | Select-Object -First 1).IPAddress

Write-Host "`nListo! PocketBase corre y arranca solo con Windows." -ForegroundColor Green
Write-Host "  Local:    http://localhost:$Puerto"
if ($ipMeshnet) {
    Write-Host "  Meshnet:  http://${ipMeshnet}:$Puerto"
    Write-Host "  Panel:    http://${ipMeshnet}:$Puerto/_/"
} else {
    Write-Host "  Meshnet:  activa Meshnet en NordVPN y usa la IP 100.x de este PC" -ForegroundColor Yellow
}
if (-not $DatosDesde) {
    Write-Host "`nSi es una instalacion nueva (sin datos copiados), crea el superusuario con:"
    Write-Host "  & '$Exe' superuser upsert TU_EMAIL 'TU_CONTRASENA' --dir '$Datos'"
}

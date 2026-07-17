$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

$health = $null
for ($i = 0; $i -lt 20; $i++) {
    try {
        $health = Invoke-RestMethod "$base/health"
        if ($health.status -eq 'ok') { break }
    } catch {
        Start-Sleep -Seconds 1
    }
}
if (-not $health -or $health.status -ne 'ok') { throw 'Gateway no saludable después de 20 segundos' }

$credentials = @{ email = 'carlos.angulo@udla.edu.ec'; password = 'ControlPro2026!' } | ConvertTo-Json
$session = Invoke-RestMethod "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $credentials
if (-not $session.token) { throw 'La autenticación no entregó un token' }
$headers = @{ Authorization = "Bearer $($session.token)" }

$projects = Invoke-RestMethod "$base/api/projects" -Headers $headers
if ($projects.Count -lt 1) { throw 'No se encontró el proyecto inicial' }
$projectId = $projects[0].id

$payload = @{
    percentage = 70
    evidence = 'Prueba automática: Swagger, C4 y mensajería verificados.'
    student = 'Carlos Angulo'
} | ConvertTo-Json

$progress = Invoke-RestMethod "$base/api/projects/$projectId/progress" -Method Post -Headers $headers -ContentType 'application/json' -Body $payload
if ($progress.event.status -ne 'published') { throw 'El evento no fue publicado' }

$notification = $null
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    $items = Invoke-RestMethod "$base/api/notifications" -Headers $headers
    $notification = $items | Where-Object { $_.event_id -eq $progress.event.eventId } | Select-Object -First 1
    if ($notification) { break }
}
if (-not $notification) { throw 'La función no generó la alerta esperada' }

[pscustomobject]@{
    health = $health.status
    authenticatedAs = $session.user.email
    projectId = $projectId
    eventId = $progress.event.eventId
    notification = $notification.type
} | Format-List

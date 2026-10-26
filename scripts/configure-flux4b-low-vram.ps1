param(
    [ValidateSet('Apply', 'Restore')][string]$Mode = 'Apply',
    [string]$BaseUrl = 'http://localhost:13305/api/v1',
    [string]$BackupPath = (Join-Path $PSScriptRoot '../.flux4b-profile-backup.local')
)
$ErrorActionPreference = 'Stop'
$taskUri = [uri]$BaseUrl
if ($taskUri.Scheme -ne 'http' -or $taskUri.Host -notin @('localhost', '127.0.0.1', '[::1]', '::1')) {
    throw 'Use the local Lemonade HTTP server.'
}
$taskModelName = 'Flux-2-Klein-4B'
$taskBase = $BaseUrl.TrimEnd('/')
$taskHealth = Invoke-RestMethod "$taskBase/health" -TimeoutSec 15
$taskLoaded = @($taskHealth.all_models_loaded | Where-Object model_name -eq $taskModelName)
if ($taskLoaded.Count -and ($taskLoaded[0].is_busy -or $taskLoaded[0].is_streaming)) {
    throw 'Flux 4B is busy. Retry after the current request finishes.'
}
if ($Mode -eq 'Restore') {
    $taskBackup = Get-Content -LiteralPath $BackupPath -Raw | ConvertFrom-Json
    if ($taskBackup.model_name -ne $taskModelName) { throw 'Backup model mismatch.' }
    $taskArgs = [string]$taskBackup.sdcpp_args
} else {
    # Load once if needed so the original effective model options can be backed up.
    if (-not $taskLoaded.Count) {
        Invoke-RestMethod "$taskBase/load" -Method Post -ContentType 'application/json' -Body (@{model_name=$taskModelName; save_options=$false} | ConvertTo-Json) -TimeoutSec 180 | Out-Null
        $taskHealth = Invoke-RestMethod "$taskBase/health" -TimeoutSec 15
        $taskLoaded = @($taskHealth.all_models_loaded | Where-Object model_name -eq $taskModelName)
    }
    if (-not $taskLoaded.Count) { throw 'Model state unavailable; no profile was changed.' }
    $taskOriginalArgs = [string]$taskLoaded[0].recipe_options.sdcpp_args
    $taskArgs = '--offload-to-cpu --clip-on-cpu --vae-on-cpu --diffusion-fa --vae-tiling --max-vram 4'
    if ($taskOriginalArgs -and $taskOriginalArgs -ne $taskArgs) {
        throw 'Existing custom sdcpp_args found. Review and merge them before applying this profile.'
    }
    if (-not (Test-Path -LiteralPath $BackupPath)) {
        @{model_name=$taskModelName; sdcpp_args=$taskOriginalArgs; saved_at=(Get-Date -Format o)} | ConvertTo-Json | Set-Content -LiteralPath $BackupPath -Encoding utf8
    }
}
# Preserve all other model defaults and all chat models. Do not change global SD settings.
$taskBody = @{model_name=$taskModelName; sdcpp_args=$taskArgs; save_options=$true} | ConvertTo-Json
Invoke-RestMethod "$taskBase/load" -Method Post -ContentType 'application/json' -Body $taskBody -TimeoutSec 180 | Out-Null
$taskAfter = Invoke-RestMethod "$taskBase/health" -TimeoutSec 15
$taskAfter.all_models_loaded | Where-Object model_name -eq $taskModelName | Select-Object model_name,status,recipe_options

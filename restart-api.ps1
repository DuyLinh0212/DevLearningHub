# =============================================
# restart-api.ps1  —  Khởi động lại API sạch
# Chạy: powershell -ExecutionPolicy Bypass -File D:\TT\restart-api.ps1
# =============================================

Write-Host "=== DevLearningHub API Restart ===" -ForegroundColor Cyan

# 1. Kill mọi process DevLearningHub.Api đang chạy
$existing = Get-Process -Name "DevLearningHub.Api" -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[1/3] Dang tat API cu (PID: $($existing.Id))..." -ForegroundColor Yellow
    $existing | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "      Da tat." -ForegroundColor Green
} else {
    Write-Host "[1/3] Khong co API nao dang chay." -ForegroundColor Gray
}

# 2. Kiem tra port 5122 co con bi chiem khong
$portCheck = netstat -ano | findstr ":5122" | findstr "LISTENING"
if ($portCheck) {
    $pid5122 = ($portCheck -split '\s+')[-1]
    Write-Host "[2/3] Port 5122 van bi chiem boi PID $pid5122, dang kill..." -ForegroundColor Yellow
    Stop-Process -Id $pid5122 -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "      Da giai phong port." -ForegroundColor Green
} else {
    Write-Host "[2/3] Port 5122 trong, san sang." -ForegroundColor Gray
}

# 3. Chay lai API
Write-Host "[3/3] Khoi dong API..." -ForegroundColor Cyan
Set-Location D:\TT\DevLearningHub.Api
Start-Process -FilePath "dotnet" -ArgumentList "run --launch-profile https" -WindowStyle Normal

Write-Host ""
Write-Host "API da duoc khoi dong! Cho khoang 3-5 giay de khoi dong hoan toan." -ForegroundColor Green
Write-Host "Swagger: https://localhost:7122/swagger" -ForegroundColor Cyan

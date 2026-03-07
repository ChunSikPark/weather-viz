@echo off
setlocal enabledelayedexpansion

:: ── Configuration ──────────────────────────────────────────────────────────
set PROJECT_DIR=%~dp0
set SIM_DIR=D:\Project\OneDrive - Texas A&M University\Desktop\Research Project\Weather\Simulation\Function
set LOG_DIR=%PROJECT_DIR%logs
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%LOG_DIR%\pipeline_%TIMESTAMP%.log

:: Create log directory
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo ============================================================ >> "%LOG_FILE%"
echo Pipeline run started at %date% %time% >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"

:: ── Step 1: Run simulation in forecast mode ────────────────────────────────
echo [Step 1/3] Running forecast simulation... >> "%LOG_FILE%"
echo [Step 1/3] Running forecast simulation...

cd /d "%SIM_DIR%"
python main.py >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo [FAILED] Simulation failed with exit code %errorlevel% >> "%LOG_FILE%"
    echo [FAILED] Simulation failed. Check log: %LOG_FILE%
    exit /b 1
)
echo [OK] Simulation complete >> "%LOG_FILE%"

:: ── Step 2: Run preprocessing ──────────────────────────────────────────────
echo [Step 2/3] Running preprocessing... >> "%LOG_FILE%"
echo [Step 2/3] Running preprocessing...

cd /d "%PROJECT_DIR%"
python scripts\preprocess.py --mode forecast --sim-dir "%SIM_DIR%" >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo [FAILED] Preprocessing failed with exit code %errorlevel% >> "%LOG_FILE%"
    echo [FAILED] Preprocessing failed. Check log: %LOG_FILE%
    exit /b 1
)
echo [OK] Preprocessing complete >> "%LOG_FILE%"

:: ── Step 3: Commit and push to GitHub ──────────────────────────────────────
echo [Step 3/3] Pushing to GitHub... >> "%LOG_FILE%"
echo [Step 3/3] Pushing to GitHub...

cd /d "%PROJECT_DIR%"
git add data/ >> "%LOG_FILE%" 2>&1
git commit -m "Update data: %date% %time%" >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Nothing to commit (data unchanged) >> "%LOG_FILE%"
    echo [INFO] No data changes to push.
    exit /b 0
)
git push >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo [FAILED] Git push failed >> "%LOG_FILE%"
    echo [FAILED] Git push failed. Check log: %LOG_FILE%
    exit /b 1
)
echo [OK] Pushed to GitHub >> "%LOG_FILE%"

echo ============================================================ >> "%LOG_FILE%"
echo Pipeline completed successfully at %date% %time% >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"
echo [DONE] Pipeline completed successfully.

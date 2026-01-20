@echo off
echo ========================================
echo Building Spotify Alt for Production
echo ========================================
echo.

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies
    exit /b %errorlevel%
)

echo.
echo [2/3] Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed
    exit /b %errorlevel%
)

echo.
echo [3/3] Build complete!
echo ========================================
echo.
echo Production files are in: dist/
echo.
echo To preview: npm run preview
echo To deploy: Serve the dist/ folder
echo.
echo ========================================
pause

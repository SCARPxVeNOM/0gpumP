@echo off
echo 🚀 Starting 0G Storage Integration...
echo.

echo 📁 Starting 0G Storage TypeScript Starter Kit...
echo    This will run on http://localhost:3000
start "0G Storage Starter Kit" cmd /k "cd 0g-storage-ts-starter-kit && npm run dev"

echo.
echo ⏳ Waiting for 0G Storage to start...
timeout /t 5 /nobreak > nul

echo 📁 Starting Integration Backend Server...
echo    This will run on http://localhost:4000
start "Integration Backend" cmd /k "npm run dev:backend"

echo.
echo ⏳ Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo.
echo ✅ Both services are starting up!
echo.
echo 🌐 0G Storage API: http://localhost:3000/api-docs/
echo 🔗 Integration Backend: http://localhost:4000/health
echo.
echo 🧪 To test the integration, run: npm run test:storage
echo.
echo 📖 Check the 0G_STORAGE_INTEGRATION.md file for detailed usage instructions
echo.
pause


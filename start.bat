@echo off
echo ========================================
echo   工作总结生成工具 - 启动器
echo ========================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo [警告] .env 文件不存在！
    echo 请复制 .env.example 为 .env 并配置 API Key
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [提示] 正在安装依赖...
    call npm install
    echo.
)

REM Start server
echo [提示] 正在启动服务器...
echo.
call npm start

pause

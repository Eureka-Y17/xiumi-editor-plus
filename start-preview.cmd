@echo off
chcp 65001 >nul
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 24 或更新版本：https://nodejs.org/
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
  echo 请将 Node.js 更新到 24 或更新版本后重试。
  pause
  exit /b 1
)
if not exist "node_modules\jsdom\package.json" (
  echo 正在准备本机预览服务，首次使用需要联网下载依赖……
  call npm.cmd ci --omit=dev --ignore-scripts
  if errorlevel 1 (
    echo 准备失败，请检查网络后重新打开。
    pause
    exit /b 1
  )
)
echo 服务启动后，把配对码复制到编辑台的「连接」中。
echo 手机与电脑请连接同一 Wi-Fi。按 Ctrl+C 可停止服务。
call npm.cmd run bridge -- --lan
pause

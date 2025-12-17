@echo off
REM 设置 HoneyGUI SDK 路径（Windows）
REM 使用方法: set-sdk-path.bat C:\path\to\HoneyGUI-SDK

if "%1"=="" (
    echo 错误: 请提供 SDK 路径
    echo 使用方法: set-sdk-path.bat C:\path\to\HoneyGUI-SDK
    echo.
    echo 或者使用默认路径:
    echo   set HONEYGUI_SDK_PATH=C:\HoneyGUI-SDK
    exit /b 1
)

set HONEYGUI_SDK_PATH=%1
echo ✓ SDK 路径已设置: %HONEYGUI_SDK_PATH%
echo.
echo 验证配置:
echo   echo %HONEYGUI_SDK_PATH%
echo.
echo 运行测试:
echo   npm run test:video-formats
echo.
echo 注意: 此设置仅在当前命令行窗口有效
echo 要永久设置，请添加到系统环境变量
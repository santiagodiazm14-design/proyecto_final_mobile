@echo off
set "ANDROID_HOME=C:\Users\sena\AppData\Local\Android\Sdk"
set "ANDROID_SDK_ROOT=C:\Users\sena\AppData\Local\Android\Sdk"
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

cd /d "%~dp0\android"
echo Iniciando compilacion de APK con Gradle...
call gradlew.bat assembleDebug --no-daemon
echo Codigo de salida de Gradle: %ERRORLEVEL%

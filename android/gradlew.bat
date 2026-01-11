@echo off
setlocal

set DIR=%~dp0

set JAVA_CMD=java
if not "%JAVA_HOME%"=="" (
  if exist "%JAVA_HOME%\bin\java.exe" (
    set JAVA_CMD="%JAVA_HOME%\bin\java.exe"
  )
)

%JAVA_CMD% -classpath "%DIR%gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain %*
endlocal

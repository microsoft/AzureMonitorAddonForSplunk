set version=%1
set ta_folder=TA-Azure_Monitor
set version_folder=%ta_folder%_%version%

REM Set working directory to location of this script file.
cd /d "%~dp0"

REM Clean up any existing packages for this version.
del %temp%\%version_folder%.spl
del ..\packages\%version_folder%.spl

mkdir %ta_folder% 
xcopy ..\bin\* %ta_folder%\bin\ /S
xcopy ..\default\* %ta_folder%\default\ /S
xcopy ..\README\* %ta_folder%\README\ /S
xcopy ..\static\* %ta_folder%\static\ /S
xcopy ..\LICENSE %ta_folder%
xcopy ..\README.md %ta_folder%

REM Build the package file for this version
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\*
copy %temp%\%version_folder%.tar %temp%\%version_folder%.spl
7z a -tgzip ..\packages\%version_folder%.spl %temp%\%version_folder%.spl

REM Clean up temporary working files used for packaging
del %temp%\%version_folder%.spl
del %temp%\%version_folder%.tar

rmdir %ta_folder% /S /Q

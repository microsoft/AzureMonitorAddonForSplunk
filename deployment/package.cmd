set version=1_2_6
set ta_folder=TA-Azure_Monitor
set version_folder=%ta_folder%_%version%

REM Set working directory to location of this script file.
cd /d "%~dp0"

REM Clean up any existing packages for this version.
del %temp%\%version_folder%.spl
del ..\packages\%version_folder%.spl

REM Build the package file for this version
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\bin\*.cmd
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\bin\*.sh
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\bin\*.py
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\bin\sourcetypes.json
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\bin\app\*.js
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\bin\app\*.json
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\bin\app\*.py
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\static\*.*
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\default\*
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\README\*
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\LICENSE
7z a -ttar %temp%\%version_folder%.tar %ta_folder%\README.md
copy %temp%\%version_folder%.tar %temp%\%version_folder%.spl
7z a -tgzip ..\packages\%version_folder%.spl %temp%\%version_folder%.spl

REM Clean up temporary working files used for packaging
del %temp%\%version_folder%.spl
del %temp%\%version_folder%.tar

exit

set version=TA-Azure_Monitor_1_2_6

cd /d "%~dp0"
del /Q /S .\temp\*
rd /Q /S .\temp\TA-Azure_Monitor
md .\temp\TA-Azure_Monitor

xcopy /S ..\bin .\temp\TA-Azure_Monitor\bin\
xcopy /S ..\static .\temp\TA-Azure_Monitor\static\
xcopy /S ..\default .\temp\TA-Azure_Monitor\default\
xcopy /S ..\readme .\temp\TA-Azure_Monitor\readme\
xcopy ..\license .\temp\TA-Azure_Monitor\
xcopy ..\readme.md .\temp\TA-Azure_Monitor\

del ..\packages\%version%.spl

7z a -ttar temp\%version%.tar .\temp\TA-Azure_Monitor\

copy .\temp\%version%.tar .\temp\%version%.spl
7z a -tgzip ..\packages\%version%.spl .\temp\%version%.spl
del .\temp\%version%.spl
del .\temp\%version%.tar






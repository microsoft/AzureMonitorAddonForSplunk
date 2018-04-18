set version=TA-Azure_Monitor_1_2_6

cd /d "%~dp0"
del /Q /S .\temp\*
rd /Q /S .\temp\TA-Azure_Monitor
md .\temp\TA-Azure_Monitor

xcopy /S /K /X ..\bin .\temp\TA-Azure_Monitor\bin\
del .\temp\TA-Azure_Monitor\bin\metricDefinitions.json
xcopy /S /K /X ..\static .\temp\TA-Azure_Monitor\static\
xcopy /S /K /X ..\default .\temp\TA-Azure_Monitor\default\
xcopy /S /K /X ..\readme .\temp\TA-Azure_Monitor\readme\
xcopy /K /X ..\license .\temp\TA-Azure_Monitor\
xcopy /K /X ..\readme.md .\temp\TA-Azure_Monitor\

del ..\packages\%version%.spl

7z a -ttar temp\%version%.tar .\temp\TA-Azure_Monitor\

copy .\temp\%version%.tar .\temp\%version%.spl
7z a -tgzip ..\packages\%version%.spl .\temp\%version%.spl
del .\temp\%version%.spl
del .\temp\%version%.tar
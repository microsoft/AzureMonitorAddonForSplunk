set version=TA-Azure_Monitor_Logs_0_9_3
cd deployment
del temp\%version%.spl
del ..\packages\%version%.spl
7z a -ttar temp\%version%.tar TA-Azure_Monitor_Logs\bin\app\*.js
7z a -ttar temp\%version%.tar TA-Azure_Monitor_Logs\bin\app\*.json
7z a -ttar temp\%version%.tar TA-Azure_Monitor_Logs\default\*
7z a -ttar temp\%version%.tar TA-Azure_Monitor_Logs\README\*
copy temp\%version%.tar temp\%version%.spl
7z a -tgzip ..\packages\%version%.spl temp\%version%.spl
exit

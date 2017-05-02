set version=TA-Azure_Monitor_1_0_1
cd deployment
del temp\%version%.spl
del ..\packages\%version%.spl
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\azure_diagnostic_logs.cmd
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\azure_diagnostic_logs.sh
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\azure_activity_log.cmd
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\azure_activity_log.sh
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\*.py
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\sourcetypes.json
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\app\*.js
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\app\*.json
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\app\*.py
7z a -ttar temp\%version%.tar TA-Azure_Monitor\static\*.*
7z a -ttar temp\%version%.tar TA-Azure_Monitor\default\*
7z a -ttar temp\%version%.tar TA-Azure_Monitor\README\*
7z a -ttar temp\%version%.tar TA-Azure_Monitor\LICENSE
7z a -ttar temp\%version%.tar TA-Azure_Monitor\README.md
copy temp\%version%.tar temp\%version%.spl
7z a -tgzip ..\packages\%version%.spl temp\%version%.spl
exit

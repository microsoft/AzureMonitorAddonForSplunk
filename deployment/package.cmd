set version=TA-Azure_Monitor_1_2_2
cd deployment
del temp\%version%.spl
del ..\packages\%version%.spl
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\*.cmd
7z a -ttar temp\%version%.tar TA-Azure_Monitor\bin\*.sh
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

REM This am_depends file handles python dependencies only.
REM Set a few vars. Tailor as needed.
REM
set SPLUNK_HOME=c:\Program Files\Splunk
set PYTHON_SITEPACKAGES=c:\python27\lib\site-packages
set SPLUNK_SITE_PACKAGES=c:\program files\splunk\Python-2.7\lib\site-packages

REM Install a few packages. They drag in dependents.
REM
pip install splunk-sdk 
pip install adal
pip install futures

REM Because pip isn't installed with Splunk's Python 2.7,
REM Python 2.7 is installed along with pip to install the add-on.
REM That pip puts packages into its own site packages. They
REM must be copied into Splunk's site packages in order for the 
REM add-on to be able to use them.
REM
xcopy /SQY "%PYTHON_SITEPACKAGES%"\splunklib "%SPLUNK_SITE_PACKAGES%"\splunklib\
xcopy /SQY "%PYTHON_SITEPACKAGES%"\concurrent "%SPLUNK_SITE_PACKAGES%"\concurrent\
xcopy /SQY "%PYTHON_SITEPACKAGES%"\adal "%SPLUNK_SITE_PACKAGES%"\adal\
xcopy /SQY "%PYTHON_SITEPACKAGES%"\jwt "%SPLUNK_SITE_PACKAGES%"\jwt\
xcopy /SQY "%PYTHON_SITEPACKAGES%"\dateutil "%SPLUNK_SITE_PACKAGES%"\dateutil\
xcopy /QY "%PYTHON_SITEPACKAGES%"\six.py "%SPLUNK_SITE_PACKAGES%"\

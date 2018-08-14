#!/bin/bash  

# This file requires LF line endings, rather than CRLF.
# If CRLF line endings creep in, it produces error 127 when
# attempting to initialize the data input in Splunk.
#
# AZURE_ENVIRONMENT tells the add-on which cloud you're operating in
# valid values are:
# AzureCloud = public Azure 
# AzureUSGovernment = US government clouds, including DoD
# AzureChinaCloud = China's sovereign cloud
# AzureGermanCloud = Germany's sovereign cloud
export AZURE_ENVIRONMENT=AzureCloud

current_dir=$(dirname "$0")
"$SPLUNK_HOME/bin/splunk" cmd node "$current_dir/app/azure_activity_log.js" $@

#!/bin/bash  

current_dir=$(dirname "$0")
"$SPLUNK_HOME/bin/splunk" cmd node "$current_dir/app/azure_monitor_logs.js" $@
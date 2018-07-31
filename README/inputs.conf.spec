[azure_diagnostic_logs://<value>]
*Azure Monitor Diagnostic Logs Add-on For Splunk

SPNTenantID = <value> # Not required when using MSI Authentication
SPNApplicationId = <value> # Not required when using MSI Authentication
SPNApplicationKey = <value> # Not required when using MSI Authentication
eventHubNamespace = <value>
vaultName = <value>
secretName = <value>
secretVersion = <value>

[azure_activity_log://<value>]
*Azure Monitor Activity Log Add-on For Splunk

SPNTenantID = <value> # Not required when using MSI Authentication
SPNApplicationId = <value> # Not required when using MSI Authentication
SPNApplicationKey = <value> # Not required when using MSI Authentication
eventHubNamespace = <value>
vaultName = <value>
secretName = <value>
secretVersion = <value>

[azure_monitor_metrics://<name>]
*Azure Monitor Metrics Add-on For Splunk

SPNTenantID = <value> # Not required when using MSI Authentication
SPNApplicationId = <value> # Not required when using MSI Authentication
SPNApplicationKey = <value> # Not required when using MSI Authentication
SubscriptionId = <value>
vaultName = <value> # Not required when using MSI Authentication
secretName = <value> # Not required when using MSI Authentication
secretVersion = <value> # Not required when using MSI Authentication

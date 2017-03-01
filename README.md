# Splunk Add-on For Azure Monitor Logs

This add-on was built in accordance with the guidelines on this page:<br/>
[How to work with modular inputs in the Splunk SDK for JavaScript](http://dev.splunk.com/view/javascript-sdk/SP-CAAAEXM)

It consumes Diagnostic Logs according to the techniques defined by Azure Monitor, which provides highly granular and real-time monitoring data for any Azure resource, and passes those selected by the user's configuration along to Splunk.

I'll refer to Splunk Add-on for Azure Monitor Logs as 'the add-on' further down in this text.

Here are a few resources if you want to learn more:<br/>
* [Overview of Azure Monitor](https://docs.microsoft.com/en-us/azure/monitoring-and-diagnostics/monitoring-overview)
* [Overview of Azure Diagnostic Logs](https://docs.microsoft.com/en-us/azure/monitoring-and-diagnostics/monitoring-overview-of-diagnostic-logs)

## Installation
In both Windows and Linux cases, it's easiest if you first clone the repo into your personal space.

1. Go to Manage Apps in the Splunk Web interface.
2. Click the button to "Install app from file"
3. Select "TA-Azure_monitor_logs_1_0.spl" from the repo directory on your PC
4. Restart Splunk <br/><br/>
(Jump down to _After restarting Splunk_)

## Manual installation for developers

### Windows
$SPLUNK_HOME defaults to `c:\program files\splunk`. <br/>
$SPLUNK_DB defaults to `c:\program files\splunk\var\lib\splunk`.

1. Copy the contents of the cloned repo into `$SPLUNK_HOME/etc/apps/TA-Azure_Monitor_Logs`.
2. Create `$SPLUNK_DB\modinputs\azure_monitor_logs`. 
3. Alter permissions on the folder such that SYSTEM has read/write/update.
4. Restart Splunk

### Linux
$SPLUNK_HOME defaults to `/opt/splunk`. <br/>
$SPLUNK_DB defaults to `/datadrive/splunk_db`.

1. Copy the contents of the cloned repo into `$SPLUNK_HOME/etc/apps/TA-Azure_Monitor_Logs`. 
2. Install node.js using the guidance on this page: [Installing Node.js via package manager](https://nodejs.org/en/download/package-manager/)
3. From `$SPLUNK_HOME/etc/apps/TA-Azure_Monitor_Logs/bin/app`, execute the following: `sudo npm install`
4. From `$SPLUNK_HOME/etc/apps`, execute the following:
`sudo chown -R splunk:splunk TA-Azure_Monitor_Logs`
5. From `$SPLUNK_HOME/etc/apps/TA-Azure_Monitor_Logs/bin/app`, execute the following: `sudo chmod +x azure_monitor_logs.sh`
6. Restart Splunk

### After restarting Splunk
In the Apps manager screen of the Splunk Web UI you should now see "Azure Monitor Logs". In Settings / Data Inputs you should see in the Local Inputs list "Azure Monitor Logs". Create a new instance of the add-on and supply the needed inputs according to the Inputs section below. I name my instances according to the resource group that I'm monitoring with it, but you may have other naming standards.

## Inputs: (all are required)

| Input Name | Example | Notes |
|------------|---------|-------|
| subscriptionId | `7X3X6Xd6-8XX8-46XX-8XXd-eaXXXXXXX52d` | your azure subscription id |
| resourceGroup | `myResourceGroup` | the resource group containing resources that you want logs from |
| tenantId | `XXXX88bf-XXXX-41af-XXXX-XXXXd011XXXX` | your Azure AD tenant id |
| clientId | `0edc5126-XXXX-4f47-bd78-XXXXXXXXXXXX` | your Service Principal Application ID |
| clientSecret | `7lqd4scZWpxjBe6dQyYBY2bFjk+8jio9iOvCv65gf9w=` | your Service Principal password |
| eventHubNamespace | `myEventHubNamespace` | the namespace of the event hub receiving logs |
| sasKeyName | `RootManageSharedAccessKey` | the SAS key associated with your event hub namespace |
| sasKeyValue | `ZhLwp9lsVWQt5UFgnogJXFbMnD8RDuHWgY0J9RN1ctE=` | the SAS password associated with that SAS key |

Click the "More Settings" box and provide the following: (required)
* Interval = 60
* Set sourcetype = manual
* Source Type = azureMonitorLogs
* Index = main

These are the values that I use on my test system and of course you may have other standards for index and sourcetype values. The add-on takes no dependency on the values you use.

### What's an Azure AD Service Principal and where can I get one?
See here: [Use portal to create Active Directory application and service principal that can access resources](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-create-service-principal-portal)

## Resource tags: (required)

All ARM resources can have an arbitrary collection of tags associated with them. Tell the add-on to send logs for a resource to Splunk by adding a tag to the resource named DiagnosticLogs and set its value to True. This can be done in various ways including the portal.<br/>
*If you don't put in the tags, you won't get any logs.*<br/>
To learn more: [Use tags to organize your Azure resources](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-using-tags)

## config.json
For each log category `config.json` provides the name of the hub written to. Multiple log categories may be written to by a single resource type. It also identifies the name of the resource ID property on a resourceType-by-resourceType basis. It's a static file that will be updated periodically as more Azure resources start to send telemetry through Azure Monitor.

## How the add-on works
The add-on assumes that you have a set of Azure resources (such as VMs, networks, storage) in a resource group and you want to monitor those resources as a group.<br/>

### How it works, step-by-step (The add-on is invoked once per minute by Splunk Enterprise)
* Get an authentication token for ARM api's.
* Get the list of hubs in the event hub namespace
* Get the list of resources in the resource group
* For each resource in the list, see if the DiagnosticLogs tag is True.
* From these data, determine which hubs to 'listen to'
* For each of those hubs, create a listener
* Wait for messages, passing along into Splunk as needed
* If there's 1 second of silence across all hubs, terminate

## Logging

Logs are generated by Logger. Errors and Warnings will appear in `splunkd.log` which is located at `$SPLUNK_HOME/var/log/splunk`. Most logs are in the debug log level. To change the log level, in the Splunk Web UI go to Settings / Server Settings / Server Logging. Search for ExecProcessor in the very long list of log channels. Change its value to whatever you want and save. It'll reset to INFO upon restarting Splunk unless you change it permanently via other means.

# Contributing

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

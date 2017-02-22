# Splunk Add-on For Azure Monitor Logs

This add-on and directory structure was built in accordance with the guidelines on this page:
http://dev.splunk.com/view/javascript-sdk/SP-CAAAEXM 

## Installation
To install, clone into $SPLUNK_HOME/etc/apps/azureLogs. Restart Splunk. In the Splunk UI, you should now see it on the Manage Apps page as "Splunk Add-on for Azure Monitor". In Settings/Data Inputs, you should see it as "Azure Monitor Logs". Add an instance and put in the inputs in the following Inputs section.

The add-on wants to checkpoint in $SPLUNK_DB/modinputs/azureLogs. On a Windows system, SYSTEM needs read/write/update permissions. Add the directory and set permissions via Windows Explorer.

## Inputs are:

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

## config.json
config.json provides for each log category the name of the hub written to. Multiple log categories may be written by a single resource type. It also identifies the name of the resource ID property on a resourceType-by-resourceType basis.

# Contributing

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

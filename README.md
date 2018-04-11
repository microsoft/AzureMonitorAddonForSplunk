# Azure Monitor Add-on for Splunk

## NOTE

Please log your feature requests as issues.

This add-on is built using Node.js and Python 2.7 and has been tested on Ubuntu 14.04, Windows 10 and RHEL 7.

It consumes Metrics, Diagnostic Logs and the Activity Log according to the techniques defined by Azure Monitor, which provides highly granular and real-time monitoring data for Azure resources, and passes those selected by the user's configuration along to Splunk. 

Here are a few resources if you want to learn more about Azure Monitor:<br/>
* [Overview of Azure Monitor](https://docs.microsoft.com/en-us/azure/monitoring-and-diagnostics/monitoring-overview)
* [Overview of Azure Diagnostic Logs](https://docs.microsoft.com/en-us/azure/monitoring-and-diagnostics/monitoring-overview-of-diagnostic-logs)
* [Overview of the Azure Activity Log](https://docs.microsoft.com/en-us/azure/monitoring-and-diagnostics/monitoring-overview-activity-logs)
* [Overview of Metrics in Microsoft Azure](https://docs.microsoft.com/en-us/azure/monitoring-and-diagnostics/monitoring-overview-metrics)  

## Installation and Configuration (manual)

See the [Wiki](https://github.com/Microsoft/AzureMonitorAddonForSplunk/wiki/Azure-Monitor-Addon-For-Splunk) for detailed installation and configuration instructions. Release Notes (aka changelog) is also available in the wiki.

### What's an Azure AD Service Principal and where can I get one?
See here: [Use portal to create Active Directory application and service principal that can access resources](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-create-service-principal-portal)<br/>

## Installation and Configuration ("mostly" automated)

1. Open `.\scripts\azure-setup.ps1`.  Replace the variables at the top of the script with values from your environment.
   * `$subscriptionId` : Your Azure subscription Id.
   * `$tenantId` : The tenant / directory Id for your Azure subscription.
   * `$splunkResourceGroupName` : The name of the resource group to deploy the cluster into.  This can be a new or existing resource group.
   * `$splunkResourceGroupLocation` : The location you want to deploy the cluster in.  For example, _eastus_, _westus_, etc.

   An example showing the variables populated is shown here:
   ![sample script output](./images/script-variables.png)
2. Run the script.
   * Note: The script will prompt you to authenticate to your Azure subscription.

   The output for the script will look similar to the output shown here:
   ![sample script output](./images/script-output.png)
3. Install Node.js and Python on your Splunk Enterprise instance as described [here](https://github.com/Microsoft/AzureMonitorAddonForSplunk/wiki/Installation).
4. Configure data inputs in Splunk as described [here](https://github.com/Microsoft/AzureMonitorAddonForSplunk/wiki/Configuration-of-Splunk).

# Support

If you have encountered difficulties with the add-on, the first thing to do is ensure that all Python and Nodejs dependencies are installed correctly according to the installation instructions in the wiki.  

If that doesn't help, the next thing to do is switch logging for ExecProcessor to Debug (Settings / Server Settings / Server Logging in Splunk Web) and recycle the add-on (disable/enable). Then search for 'azure_monitor' ERROR and DEBUG messages. There will be a lot of DEBUG messages. If you don't see anything helpful, open an issue in the repo.  

# Contributing

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

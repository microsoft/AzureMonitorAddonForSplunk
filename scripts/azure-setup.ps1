# Variables used below
$subscriptionId = "<Your Azure Subscription Id>"
$tenantId = "<Your Azure AD Tenant Id>"
$splunkResourceGroupName = "<Resource group name>"
$splunkResourceGroupLocation = "<Resource group location>"
# Note: The resource group name can be a new or existing resource group.

#################################################################
# Don't modify anything below unless you know what you're doing.
#################################################################
$ErrorActionPreference = "Stop"
$WarningPreference = "SilentlyContinue"

$azureSession = Login-AzureRmAccount -Subscription $subscriptionId -TenantId $tenantId
$splunkResourceGroup = New-AzureRmResourceGroup -Name $splunkResourceGroupName -Location $splunkResourceGroupLocation -Force
$ticks = [DateTime]::UtcNow.Ticks


# Create an Event Hub Namespace
$eventHubNamespaceName = "spleh" + $ticks
Write-Host "Creating event hub namespace '$eventHubNamespaceName'" -ForegroundColor Yellow
$eventHubNamespace = New-AzureRmEventHubNamespace -ResourceGroupName $splunkResourceGroup.ResourceGroupName `
                        -Location $splunkResourceGroup.Location -Name $eventHubNamespaceName
$eventHubRootKey = Get-AzureRmEventHubKey -ResourceGroupName $eventHubNamespace.ResourceGroup `
                        -Namespace $eventHubNamespace.Name -Name "RootManageSharedAccessKey"

# Create a Key Vault
$keyVaultName = "splkv" + $ticks
Write-Host "Creating Key Vault '$keyVaultName'" -ForegroundColor Yellow
$keyVault = New-AzureRmKeyVault -ResourceGroupName $splunkResourceGroup.ResourceGroupName `
                -Location $splunkResourceGroup.Location -VaultName $keyVaultName
Write-Host "- Setting default access policy for '$($azureSession.Context.Account.Id)'" -ForegroundColor Yellow
Set-AzureRmKeyVaultAccessPolicy -ResourceGroupName $keyVault.ResourceGroupName -VaultName $keyVault.VaultName `
    -EmailAddress $azureSession.Context.Account `
    -PermissionsToSecrets get,list,set,delete,recover,backup,restore `
    -PermissionsToKey get,list,update,create,import,delete,recover,backup,restore


# Create an Azure AD App registration
$splunkAzureADAppName = "spladapp" + $ticks
$splunkAzureADAppHomePage = "https://" + $splunkAzureADAppName
Write-Host "Creating an Azure AD application registration '$splunkAzureADAppName'" -ForegroundColor Yellow
$azureADApp = New-AzureRmADApplication -DisplayName $splunkAzureADAppName -HomePage $splunkAzureADAppHomePage `
                -IdentifierUris $splunkAzureADAppHomePage

# Create a new client secret / credential for the Azure AD App registration
$bytes = New-Object Byte[] 32
$rand = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rand.GetBytes($bytes)
$clientSecret = [System.Convert]::ToBase64String($bytes)
$clientSecretSecured = ConvertTo-SecureString -String $clientSecret -AsPlainText -Force
$endDate = [System.DateTime]::Now.AddYears(1)
Write-Host "- Adding a client secret / credential for the application" -ForegroundColor Yellow
New-AzureRmADAppCredential -ApplicationId $azureADApp.ApplicationId -Password $clientSecretSecured -EndDate $endDate

# Create an Azure AD Service Principal associated with the Azure AD App
Write-Host "Creating service principal for Azure AD application '$($azureADApp.ApplicationId)'" -ForegroundColor Yellow
$azureADSP = New-AzureRmADServicePrincipal -ApplicationId $azureADApp.ApplicationId

# Need to pause after creaeting the service principal or you may get an error on the next call indicating the SP doesn't exist.
Start-Sleep -Seconds 30

# Assign the service principal to the Reader role for the Azure subscription
Write-Host "Adding service principal '$($azureADSP.Id)' to the Reader role for the subscription." -ForegroundColor Yellow
New-AzureRmRoleAssignment -RoleDefinitionName "Reader" -Scope "/subscriptions/$subscriptionId" -ObjectId $azureADSP.Id

# Give the service principal permissions to retrieve secrets from the key vault
Write-Host "Assigning key vault 'read' permissions to secrets for service principal '$($azureADSP.Id)'" -ForegroundColor Yellow 
Set-AzureRmKeyVaultAccessPolicy -ResourceGroupName $keyVault.ResourceGroupName -VaultName $keyVault.VaultName `
    -PermissionsToSecrets "get" -ObjectId $azureADSP.Id

# Add secrets to keyvault for event hub and REST API credentials
Write-Host "Adding secrets to event hub namespace" -ForegroundColor Yellow
$eventHubPrimaryKeySecured = ConvertTo-SecureString -String $eventHubRootKey.PrimaryKey -AsPlainText -Force
$eventHubCredentialsSecret = Set-AzureKeyVaultSecret -VaultName $keyVault.VaultName -Name "myEventHubCredentials" `
    -ContentType $eventHubRootKey.KeyName -SecretValue $eventHubPrimaryKeySecured
$restAPICredentialsSecret = Set-AzureKeyVaultSecret -VaultName $keyVault.VaultName -Name "myRESTAPICredentials" `
    -ContentType $azureADSP.ApplicationId -SecretValue $clientSecretSecured

# Create a new log profile to export activity log to event hub
Write-Host "Configuring Azure Monitor Activity Log to export to event hub '$eventHubNamespaceName'" -ForegroundColor Yellow
$logProfileName = "default"
$locations = (Get-AzureRmLocation).Location
$locations += "global"
$serviceBusRuleId = "/subscriptions/$subscriptionId/resourceGroups/$splunkResourceGroupName" + ` 
                    "/providers/Microsoft.EventHub/namespaces/$eventHubNamespaceName" + `
                    "/authorizationrules/RootManageSharedAccessKey"
Remove-AzureRmLogProfile -Name $logProfileName -ErrorAction SilentlyContinue
Add-AzureRmLogProfile -Name $logProfileName -Location $locations -ServiceBusRuleId $serviceBusRuleId 

Write-Host "Azure configuration completed successfully!" -ForegroundColor Green

# Configure Splunk
# Settings needed to configure Splunk
Write-Host ""
Write-Host "****************************"
Write-Host "*** SPLUNK CONFIGURATION ***"
Write-Host "****************************"
Write-Host ""
Write-Host "Data Input Settings for configuration as explained at https://github.com/Microsoft/AzureMonitorAddonForSplunk/wiki/Configuration-of-Splunk"
Write-Host ""
Write-Host "  AZURE MONITOR ACTIVITY LOG"
Write-Host "  ----------------------------"
Write-Host "  Name:               Azure Monitor Activity Log"
Write-Host "  SPNTenantID:       " $azureSession.Context.Tenant.Id
Write-Host "  SPNApplicationId:  " $azureADSP.ApplicationId
Write-Host "  SPNApplicationKey: " $clientSecret
Write-Host "  eventHubNamespace: " $eventHubNamespace.Name
Write-Host "  vaultName:         " $keyVault.VaultName
Write-Host "  secretName:        " $eventHubCredentialsSecret.Name
Write-Host "  secretVersion:     " $eventHubCredentialsSecret.Version
Write-Host ""
Write-Host "  AZURE MONITOR DIAGNOSTIC LOG"
Write-Host "  ----------------------------"
Write-Host "  Name:               Azure Monitor Diagnostic Log"
Write-Host "  SPNTenantID:       " $azureSession.Context.Tenant.Id
Write-Host "  SPNApplicationId:  " $azureADSP.ApplicationId
Write-Host "  SPNApplicationKey: " $clientSecret
Write-Host "  eventHubNamespace: " $eventHubNamespace.Name
Write-Host "  vaultName:         " $keyVault.VaultName
Write-Host "  secretName:        " $eventHubCredentialsSecret.Name
Write-Host "  secretVersion:     " $eventHubCredentialsSecret.Version
Write-Host ""
Write-Host "  AZURE MONITOR METRICS"
Write-Host "  ----------------------------"
Write-Host "  Name:               Azure Monitor Metrics"
Write-Host "  SPNTenantID:       " $azureSession.Context.Tenant
Write-Host "  SPNApplicationId:  " $azureADSP.ApplicationId
Write-Host "  SPNApplicationKey: " $clientSecret
Write-Host "  SubscriptionId:    " $azureSession.Context.Subscription
Write-Host "  vaultName:         " $keyVault.VaultName
Write-Host "  secretName:        " $restAPICredentialsSecret.Name
Write-Host "  secretVersion      " $restAPICredentialsSecret.Version




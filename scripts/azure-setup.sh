#!/bin/bash

set -e

showErrorAndUsage() {
  echo
  if [[ "$1" != "" ]]
  then
    echo "  error:  $1"
    echo
  fi

  echo "usage:  $(basename ${0}) [options]"
  echo "options:"
  echo "  -l <location>            : [Required] Location to provision resources in. Ex. westus, eastus, etc."
  echo "  -r <resource group name> : [Required] Resource group to deploy resources into."
  echo "  -s <subscription id>     : [Required] Azure subscription Id."
  echo "  -t <tenant id>           : [Required] Azure Active Directory / Tenant Id."
  exit 1
}

LOCATION=""
RESOURCE_GROUP_NAME=""
SUBSCRIPTION_ID=""
TENANT_ID=""

while getopts ':l:r:s:t:' opt; do
    case $opt in
        l)
            LOCATION=$OPTARG
            ;;
        r)
            RESOURCE_GROUP_NAME=$OPTARG
            ;;
        s)
            SUBSCRIPTION_ID=$OPTARG
            ;;
        t)
            TENANT_ID=$OPTARG
            ;;
        ?)
            showErrorAndUsage
            ;;
    esac
done

if [[ $LOCATION == "" || $RESOURCE_GROUP_NAME == "" || $SUBSCRIPTION_ID == "" || $TENANT_ID == "" ]]
then
    echo $LOCATION
    echo $RESOURCE_GROUP_NAME
    echo $SUBSCRIPTION_ID
    echo $TENANT_ID
    showErrorAndUsage
fi

# Authenticate to Azure as an interactive user and set the target subscription.
SUBSCRIPTIONS=$(az login --tenant $TENANT_ID)
az account set --subscription $SUBSCRIPTION_ID
AZURE_USER=$(az account show --query user.name)
AZURE_USER=${AZURE_USER//[\"]/}
echo "User '${AZURE_USER}' successfully authenticated."

# Create the resource group that will contain the resources.
echo "Creating resource group '${RESOURCE_GROUP_NAME}' in region '${LOCATION}'."
az group create \
    --name $RESOURCE_GROUP_NAME \
    --location $LOCATION \
    --query properties.provisioningState \
    --output jsonc

TICKS=$(date +%s)

# Create an event hub namespace.
EVENTHUB_NAMESPACE_NAME="eh${TICKS}"
echo "Creating event hub namespace '${EVENTHUB_NAMESPACE_NAME}' in resource group '${RESOURCE_GROUP_NAME}'."
az eventhubs namespace create \
    --name $EVENTHUB_NAMESPACE_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --query provisioningState \
    --output jsonc
EVENTHUB_ROOT_KEY=$(az eventhubs namespace authorization-rule keys list \
    --resource-group $RESOURCE_GROUP_NAME \
    --namespace-name $EVENTHUB_NAMESPACE_NAME \
    --name RootManageSharedAccessKey \
    --query primaryKey)

# Create a key vault.
KEYVAULT_NAME="kv${TICKS}"
echo "Creating key vault '${KEYVAULT_NAME}' in resource group '${RESOURCE_GROUP_NAME}'."
az keyvault create \
    --name $KEYVAULT_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --query properties.additionalProperties.provisioningState \
    --output jsonc

# Give the interactive user (ie: Administrator) full permissions to the key vault.
echo "Giving interactive user '${AZURE_USER}' full permissions to key vault '${KEYVAULT_NAME}'."
az keyvault set-policy \
    --name $KEYVAULT_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --upn $AZURE_USER \
    --secret-permissions get list set delete recover backup restore \
    --key-permissions get list update create import delete recover backup restore \
    --query properties.additionalProperties.provisioningState \
    --output jsonc

# Create a service principal and assign it to the Reader role for the subscription.
SERVICE_PRINCIPAL_NAME="https://adap${TICKS}"
echo "Creating service principal '${SERVICE_PRINCIPAL_NAME}' in Azure AD tenant '${TENANT_ID}'."
RESULT=$(az ad sp create-for-rbac \
    --name $SERVICE_PRINCIPAL_NAME \
    --role Reader \
    --scopes /subscriptions/$SUBSCRIPTION_ID \
    --query "[appId, password] | join(',', @)")
RESULT=${RESULT//[\"]/}
RESULTS=(${RESULT//,/ })
SPN_APP_ID=${RESULTS[0]}
CLIENT_SECRET=${RESULTS[1]}

# Give the service principal permissions to read secrets from the key vault.
echo "Assigning 'read' permissions to key vault secrets for service principal '${SERVICE_PRINCIPAL_NAME}'."
az keyvault set-policy \
    --name $KEYVAULT_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --spn $SERVICE_PRINCIPAL_NAME \
    --secret-permissions get \
    --query properties.additionalProperties.provisioningState \
    --output jsonc

# Add secrets to keyvault for event hub and REST API credentials
echo "Adding secrets to key vault '${KEYVAULT_NAME}'."
EVENTHUB_SECRET_NAME="$EVENTHUB_NAMESPACE_NAME-secret"
EVENTHUB_SECRET_VERSION=$(az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name $EVENTHUB_SECRET_NAME \
    --value $EVENTHUB_ROOT_KEY \
    --query id)
EVENTHUB_SECRET_VERSION=${EVENTHUB_SECRET_VERSION//[\"]/}
EVENTHUB_SECRET_VERSION=(${EVENTHUB_SECRET_VERSION//// })
EVENTHUB_SECRET_VERSION=${EVENTHUB_SECRET_VERSION[-1]}

REST_API_SECRET_NAME="AzureMonitorMetric-secret"
REST_API_SECRET_VERSION=$(az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name $REST_API_SECRET_NAME \
    --value $CLIENT_SECRET \
    --query id)
REST_API_SECRET_VERSION=${REST_API_SECRET_VERSION//[\"]/}
REST_API_SECRET_VERSION=(${REST_API_SECRET_VERSION//// })
REST_API_SECRET_VERSION=${REST_API_SECRET_VERSION[-1]}

# Show output for Splunk configuration.
echo ""
echo "****************************"
echo "*** SPLUNK CONFIGURATION ***"
echo "****************************"
echo ""
echo "AZURE MONITOR ACTIVITY LOG"
echo "--------------------------"
echo "Name:              Azure Monitor Activity Log"
echo "SPNTenantID:       $TENANT_ID"
echo "SPNApplicationID:  $SPN_APP_ID"
echo "SPNApplicationKey: $CLIENT_SECRET"
echo "eventHubNamespace: $EVENTHUB_NAMESPACE_NAME"
echo "vaultName:         $KEYVAULT_NAME"
echo "secretName:        $EVENTHUB_SECRET_NAME"
echo "secretVersion:     $EVENTHUB_SECRET_VERSION"
echo ""
echo "AZURE MONITOR DIAGNOSTIC LOG"
echo "--------------------------"
echo "Name:              Azure Monitor Diagnostic Log"
echo "SPNTenantID:       $TENANT_ID"
echo "SPNApplicationID:  $SPN_APP_ID"
echo "SPNApplicationKey: $CLIENT_SECRET"
echo "eventHubNamespace: $EVENTHUB_NAMESPACE_NAME"
echo "vaultName:         $KEYVAULT_NAME"
echo "secretName:        $EVENTHUB_SECRET_NAME"
echo "secretVersion:     $EVENTHUB_SECRET_VERSION"
echo ""
echo "AZURE MONITOR METRICS"
echo "--------------------------"
echo "Name:              Azure Monitor Activity Log"
echo "SPNTenantID:       $TENANT_ID"
echo "SPNApplicationID:  $SPN_APP_ID"
echo "SPNApplicationKey: $CLIENT_SECRET"
echo "eventHubNamespace: $EVENTHUB_NAMESPACE_NAME"
echo "vaultName:         $KEYVAULT_NAME"
echo "secretName:        $EVENTHUB_SECRET_NAME"
echo "secretVersion:     $REST_API_SECRET_VERSION"
echo ""
echo "Finished Successfully!"

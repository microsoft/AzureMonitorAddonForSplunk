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
  echo "  -m <vm name>             : [Optional] VM name of VM that has MSI enabled. This will skip SPN setup and assign RBAC access for the VM."
  exit 1
}

LOCATION=""
RESOURCE_GROUP_NAME=""
SUBSCRIPTION_ID=""
TENANT_ID=""
MSI_VM=""

while getopts ':l:r:s:t:m:' opt; do
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
        m)
            MSI_VM=$OPTARG
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

# Define constants
TICKS=$(date +%s)
KEYVAULT_NAME="kv${TICKS}"
EVENTHUB_NAMESPACE_NAME="eh${TICKS}"
REST_API_SECRET_NAME="AzureMonitorMetric-secret"
EVENTHUB_SECRET_NAME="$EVENTHUB_NAMESPACE_NAME-secret"


# Authenticate to Azure as an interactive user and set the target subscription.
SUBSCRIPTIONS=$(az login --tenant $TENANT_ID)
az account set --subscription $SUBSCRIPTION_ID
AZURE_USER=$(az account show --query user.name)
AZURE_USER=${AZURE_USER//[\"]/}
echo "User '${AZURE_USER}' successfully authenticated."


function az_role_assignment_create {
    echo "Assigning role Reader to ${1} for the subscription scope"
    az role assignment create \
        --assignee $1 \
        --role 'Reader' \
        --scope /subscriptions/$SUBSCRIPTION_ID

}

function keyvault_set_policy {
    # Give the service principal permissions to read secrets from the key vault.
    echo "Assigning 'read' permissions to key vault secrets for VM  '${MSI_VM}'."
    az keyvault set-policy \
        --name $KEYVAULT_NAME \
        --resource-group $RESOURCE_GROUP_NAME \
        --object-id $1 \
        --secret-permissions get \
        --query null
}

function deploy_msi_extension {
    echo "Deploying MSI extension to '${1}'."
    VM_OS=$(az vm show -n ${1} --resource-group ${2} --query "storageProfile.osDisk.osType" -o tsv)
    if [ $VM_OS = "Linux" ]; then
        az vm extension set -n ManagedIdentityExtensionForLinux --publisher Microsoft.ManagedIdentity --vm-name $1 --resource-group $2
        echo "Linux MSI extension has been deployed to '${1}'."
    elif [ $VM_OS = "Windows" ]; then
        az vm extension set -n ManagedIdentityExtensionForWindows --publisher Microsoft.ManagedIdentity --vm-name $1 --resource-group $2
        echo "Windows MSI extension has been deployed to '${1}'."
    else
        echo "WARNING: it was not possible to identify the OS type of your VM. Please manually deploy MSI extension to your VM"
    fi
}

# Setup MSI and assign it to the Reader role for the subscription.
if [ "$MSI_VM" ] ; then
PRINCIPAL_ID=$(az resource list -n ${MSI_VM} --query '[*].identity.principalId' --out tsv)
    if [[ "$PRINCIPAL_ID" ]]; then
        echo "MSI has been enabled already for '${MSI_VM}'"

        echo "Checking if Reader role has been applied to subscription..."
        az role assignment list \
            --scope /subscriptions/$SUBSCRIPTION_ID \
            --assignee  $PRINCIPAL_ID \
            --output tsv 1>/dev/null
        if [ $? -ne 0 ]; then
            az_role_assignment_create $PRINCIPAL_ID
        fi

    else
        echo "Enabling MSI auth on '${MSI_VM}'."
        MSI_VM_RG=$(az resource list -n ${MSI_VM} --resource-type 'Microsoft.Compute/virtualMachines' --query '[*].resourceGroup' --output tsv)
        az vm identity assign -g $MSI_VM_RG -n $MSI_VM

        deploy_msi_extension $MSI_VM $MSI_VM_RG

        PRINCIPAL_ID=$(az resource list -n ${MSI_VM} --query '[*].identity.principalId' --out tsv)
        az_role_assignment_create $PRINCIPAL_ID
    fi
fi

# Create the resource group that will contain the resources.
echo "Creating resource group '${RESOURCE_GROUP_NAME}' in region '${LOCATION}'."
az group create \
    --name $RESOURCE_GROUP_NAME \
    --location $LOCATION \
    --query null

# Create an event hub namespace.
echo "Creating event hub namespace '${EVENTHUB_NAMESPACE_NAME}' in resource group '${RESOURCE_GROUP_NAME}'."
az eventhubs namespace create \
    --name $EVENTHUB_NAMESPACE_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --query null

echo "Retrieving event hub primary key."    
EVENTHUB_ROOT_KEY=$(az eventhubs namespace authorization-rule keys list \
    --resource-group $RESOURCE_GROUP_NAME \
    --namespace-name $EVENTHUB_NAMESPACE_NAME \
    --name RootManageSharedAccessKey \
    --query primaryKey)
EVENTHUB_ROOT_KEY=${EVENTHUB_ROOT_KEY//[\"]/}

# Create a key vault.
echo "Creating key vault '${KEYVAULT_NAME}' in resource group '${RESOURCE_GROUP_NAME}'."
az keyvault create \
    --name $KEYVAULT_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --query null

# Give the interactive user (ie: Administrator) full permissions to the key vault.
echo "Giving interactive user '${AZURE_USER}' full permissions to key vault '${KEYVAULT_NAME}'."
az keyvault set-policy \
    --name $KEYVAULT_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --upn $AZURE_USER \
    --secret-permissions get list set delete recover backup restore \
    --key-permissions get list update create import delete recover backup restore \
    --query null

if [ "$MSI_VM" ] ; then
    keyvault_set_policy $PRINCIPAL_ID 
else
    # Create a service principal and assign it to the Reader role for the subscription.
    SERVICE_PRINCIPAL_NAME="adap${TICKS}"
    CLIENT_SECRET=$(openssl rand -base64 32)
    echo "Creating service principal '${SERVICE_PRINCIPAL_NAME}' in Azure AD tenant '${TENANT_ID}'."
    SPN_APP_ID=$(az ad sp create-for-rbac \
        --name $SERVICE_PRINCIPAL_NAME \
        --password $CLIENT_SECRET \
        --role Reader \
        --scopes /subscriptions/$SUBSCRIPTION_ID \
        --query appId)
    SPN_APP_ID=${SPN_APP_ID//[\"]/}

    # Give the service principal permissions to read secrets from the key vault.
    echo "Assigning 'read' permissions to key vault secrets for service principal '${SERVICE_PRINCIPAL_NAME}'."
    az keyvault set-policy \
        --name $KEYVAULT_NAME \
        --resource-group $RESOURCE_GROUP_NAME \
        --spn $SPN_APP_ID \
        --secret-permissions get \
        --query null

    # Add secrets to keyvault for REST API
    REST_API_SECRET_VERSION=$(az keyvault secret set \
        --vault-name $KEYVAULT_NAME \
        --name $REST_API_SECRET_NAME \
        --description $SPN_APP_ID \
        --value $CLIENT_SECRET \
        --query id)
    REST_API_SECRET_VERSION=${REST_API_SECRET_VERSION//[\"]/}
    REST_API_SECRET_VERSION=(${REST_API_SECRET_VERSION//// })
    REST_API_SECRET_VERSION=${REST_API_SECRET_VERSION[${#REST_API_SECRET_VERSION[@]}-1]}

fi

# Add secrets to keyvault for event hub
echo "Adding secrets to key vault '${KEYVAULT_NAME}'."
EVENTHUB_SECRET_VERSION=$(az keyvault secret set \
    --vault-name $KEYVAULT_NAME \
    --name $EVENTHUB_SECRET_NAME \
    --description RootManageSharedAccessKey \
    --value $EVENTHUB_ROOT_KEY \
    --query id)
EVENTHUB_SECRET_VERSION=${EVENTHUB_SECRET_VERSION//[\"]/}
EVENTHUB_SECRET_VERSION=(${EVENTHUB_SECRET_VERSION//// })
EVENTHUB_SECRET_VERSION=${EVENTHUB_SECRET_VERSION[${#EVENTHUB_SECRET_VERSION[@]}-1]}

# Create a new log profile to export activity log to event hub
echo "Configuring Azure Monitor Activity Log to export to event hub '$EVENTHUB_NAMESPACE_NAME'."
LOCATIONS=$(az account list-locations --query "[*].name | join(',', @)")
LOCATIONS=${LOCATIONS//[\"]/}
LOCATIONS=${LOCATIONS//,/ }
LOCATIONS="${LOCATIONS} global"
LOG_PROFILE_NAME="default"
LOG_PROFILE_CATEGORIES="Delete Write Action"
SERVICE_BUS_RULE_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP_NAME/providers/Microsoft.EventHub/namespaces/$EVENTHUB_NAMESPACE_NAME/authorizationrules/RootManageSharedAccessKey"
az monitor log-profiles delete --name $LOG_PROFILE_NAME
az monitor log-profiles create \
    --name $LOG_PROFILE_NAME \
    --location null \
    --locations $LOCATIONS \
    --categories $LOG_PROFILE_CATEGORIES \
    --enabled false \
    --days 0 \
    --service-bus-rule-id $SERVICE_BUS_RULE_ID \
    --query null

# Show output for Splunk configuration.
echo ""
echo "****************************"
echo "*** SPLUNK CONFIGURATION ***"
echo "****************************"
echo ""
echo "AZURE MONITOR ACTIVITY LOG"
echo "--------------------------"
echo "Name:              Azure Monitor Activity Log"
if [ -z "$MSI_VM" ] ; then
    echo "SPNTenantID:       $TENANT_ID"
    echo "SPNApplicationID:  $SPN_APP_ID"
    echo "SPNApplicationKey: $CLIENT_SECRET"
fi
echo "eventHubNamespace: $EVENTHUB_NAMESPACE_NAME"
echo "vaultName:         $KEYVAULT_NAME"
echo "secretName:        $EVENTHUB_SECRET_NAME"
echo "secretVersion:     $EVENTHUB_SECRET_VERSION"
echo ""
echo "AZURE MONITOR DIAGNOSTIC LOG"
echo "--------------------------"
echo "Name:              Azure Monitor Diagnostic Log"
if [ -z "$MSI_VM" ] ; then
    echo "SPNTenantID:       $TENANT_ID"
    echo "SPNApplicationID:  $SPN_APP_ID"
    echo "SPNApplicationKey: $CLIENT_SECRET"
fi
echo "eventHubNamespace: $EVENTHUB_NAMESPACE_NAME"
echo "vaultName:         $KEYVAULT_NAME"
echo "secretName:        $EVENTHUB_SECRET_NAME"
echo "secretVersion:     $EVENTHUB_SECRET_VERSION"
echo ""
echo "AZURE MONITOR METRICS"
echo "--------------------------"
echo "Name:              Azure Monitor Metrics"
echo "SubscriptionId:    $SUBSCRIPTION_ID"
if [ -z "$MSI_VM" ] ; then
    echo "SPNTenantID:       $TENANT_ID"
    echo "SPNApplicationID:  $SPN_APP_ID"
    echo "SPNApplicationKey: $CLIENT_SECRET"
    echo "vaultName:         $KEYVAULT_NAME"
    echo "secretName:        $REST_API_SECRET_NAME"
    echo "secretVersion:     $REST_API_SECRET_VERSION"
fi
echo ""
echo "Finished Successfully!"

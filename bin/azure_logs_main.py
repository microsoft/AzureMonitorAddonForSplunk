# encoding = utf-8
"""
//
// AzureMonitorAddonForSplunk
//
// Copyright (c) Microsoft Corporation
//
// All rights reserved.
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the ""Software""), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is furnished
// to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
// FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
"""
from subs import get_subscription_segment, get_resources, get_azure_environment, \
    get_access_token, get_metrics_for_resources, get_secret_from_keyvault

MASK = '********'
ENVIRONMENT_AUTH_ENDPOINT = "https://login.windows.net/"
KEYVAULT_ARM_RESOURCE = 'https://vault.azure.net'

def get_logs_for_subscription(inputs, credentials, ew):
    """
        top level function
        given hub namespace and credentials, get activity logs 
    """

    metadata = inputs.metadata
    input_name, input_item = inputs.inputs.popitem()
    stanza = input_name.split('://')
    instance_name = stanza[1]

    tenant_id = input_item.get("SPNTenantID")
    spn_client_id = credentials.get('app_id')
    spn_client_secret = credentials.get('app_key')
    hub_namespace = input_item.get("eventHubNamespace")
    key_vault_name = input_item.get("vaultName")
    secret_name = input_item.get("secretName")
    secret_version = input_item.get("secretVersion")
    input_sourcetype = input_item.get("sourcetype")

    
    try:
        if spn_client_id is not None and spn_client_secret is not None:
            locale = "get_access_token for key vault SPN"
            authentication_endpoint = ENVIRONMENT_AUTH_ENDPOINT
            resource = KEYVAULT_ARM_RESOURCE

            kv_bearer_token = get_access_token(
                tenant_id,
                spn_client_id,
                spn_client_secret,
                authentication_endpoint,
                resource)

            locale = "get_secret_from_keyvault"
            hub_creds = get_secret_from_keyvault(ew, kv_bearer_token,
                key_vault_name, secret_name, secret_version)

            ew.log('DEBUG', 'Got event hub creds. Policy name: {0}, key: {1}'.format(hub_creds.get('name'), hub_creds.get('password')))
    except Exception as e:
        ew.log('ERROR', 'Error caught in get_logs_for_subscription: {0}'.format(e))

def get_or_store_secrets_hub(self, inputs, logger):
    '''
        Either read existing encyrpted password or encrypt clear text password and store it
        Either way, return a set of clear text credentials
    '''
    input_items = inputs.inputs.itervalues().next()
    input_name = inputs.inputs.iterkeys().next()

    credentials = {}
    storage_passwords = self.service.storage_passwords

    props_app_id = {}
    props_app_id['username'] = 'AzureActivityLogAppID-{0}'.format(input_name.replace(':','_'))
    props_app_id['password'] = input_items.get("SPNApplicationId")

    props_app_key = {}
    props_app_key['username'] = 'AzureActivityLogAppKey-{0}'.format(input_name.replace(':','_'))
    props_app_key['password'] = input_items.get("SPNApplicationKey")

    app_id = input_items.get("SPNApplicationId")
    app_key = input_items.get("SPNApplicationKey")

    if app_id is not None and app_key is not None:
        try:
            if ("AzureActivityLogAppID" in storage_passwords) and (props_app_id['username'] not in storage_passwords):
                # Create new unique storage password entry for AzureActivityLogAppID based on input name
                modify_storage_password(self, "AzureActivityLogAppID", props_app_id['username'], logger)

            if ("AzureActivityLogAppKey" in storage_passwords) and (props_app_key['username'] not in storage_passwords):
                # Create new unique storage password entry for AzureActivityLogAppKey based on input name
                modify_storage_password(self, "AzureActivityLogAppKey", props_app_key['username'], logger)

            if props_app_id['password'] == MASK:
                app_id, app_key = get_app_id_and_key(self, props_app_id, props_app_key, logger)
            else:
                create_or_update_storage_password(self, props_app_id, logger)
                create_or_update_storage_password(self, props_app_key, logger)
                mask_id_and_key(self, input_name, logger)
        except Exception as e:
            logger('ERROR', 'Error caught in get_or_store_secrets: {0}'.format(e))

        credentials['app_id'] = app_id
        credentials['app_key'] = app_key
    return credentials

def modify_storage_password(self, old_username, new_username, logger):
    logger('INFO', 'Updating storage password. Old username: {0}, new username: {1}'.format(old_username, new_username))
    storage_passwords = self.service.storage_passwords
    try:
        password = storage_passwords[old_username].clear_password
        storage_passwords.create(password, new_username)
    except Exception as e:
        logger('ERROR', 'Error updating storage password in modify_storage_password: {0}'.format(e))

def create_or_update_storage_password(self, props, logger):
    '''
        unencrypted password in inputs.conf, encrypt it and store as storagePassword
    '''
    try:

        locale = 'reference'
        storage_passwords = self.service.storage_passwords
        if props['username'] in storage_passwords:
            locale = 'delete'
            storage_passwords.delete(props['username'])

    except Exception as e:
        logger('ERROR', 'Error at locale {1} in create_or_update_storage_password: {0}'\
            .format(e, locale))

    try:
        locale = 'create'
        self.service.storage_passwords.create(props['password'], props['username'])
    except Exception as e:
        logger('ERROR', 'Error at locale {1} in create_or_update_storage_password: {0}'\
            .format(e, locale))


def mask_id_and_key(self, name, logger):
    '''
        masks the app_id and app_key in inputs.conf
    '''
    kind, input_name = name.split('://')
    item = self.service.inputs.__getitem__((input_name, kind))

    try:

        new_input = {
            'vaultName': item.content.vaultName,
            'SPNTenantID': item.content.SPNTenantID,
            'SPNApplicationId': MASK,
            'SPNApplicationKey': MASK,
            'eventHubNamespace': item.content.eventHubNamespace,
            'secretName': item.content.secretName,
            'secretVersion': item.content.secretVersion,
            'index': item.content.index,
            'interval': item.content.interval,
            'sourcetype': item.content.sourcetype
        }

        item.update(**new_input).refresh()

    except Exception as e:
        logger('ERROR', 'Error caught in mask_id_and_key: {0}'.format(e))

def get_app_id_and_key(self, props_app_id, props_app_key, logger):
    '''
        get the encrypted app_id and app_key from storage_passwords
    '''
    storage_passwords = self.service.storage_passwords

    if props_app_id['username'] not in storage_passwords:
        raise KeyError('Did not find app_id {} in storage_passwords.'\
            .format(props_app_id['username']))

    if props_app_key['username'] not in storage_passwords:
        raise KeyError('Did not find app_id {} in storage_passwords.'\
            .format(props_app_key['username']))

    app_id = ''
    app_key = ''
    try:
        app_id = storage_passwords[props_app_id['username']].clear_password
        app_key = storage_passwords[props_app_key['username']].clear_password
    except Exception as e:
        logger('ERROR', 'Error caught in get_app_id_and_key: {0}'.format(e))

    return app_id, app_key


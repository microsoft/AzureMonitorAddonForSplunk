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
import sys
from timewindow import put_time_window, put_time_checkpoint
from concurrent import futures
from subs import get_subscription_segment, get_resources, get_azure_environment, \
    get_access_token, get_metrics_for_resources, get_secret_from_keyvault

def get_resources_for_rgs(ew, bearer_token, sub_url, resource_groups):
    """
        map the resource groups to a function that gets resources
    """
    resource_group_names = []
    for resource_group in resource_groups:
        resource_group_names.append(resource_group['name'])

    with futures.ThreadPoolExecutor(max_workers=5) as executor:
        rg_future = dict((executor.submit(get_resources, ew, bearer_token, sub_url, rg), rg) \
            for rg in resource_group_names)

        for future in futures.as_completed(rg_future, None):
            resource_group = rg_future[future]
            if future.exception() is not None:
                ew.log('ERROR', 'Resource group {0} generated an exception: {1}'\
                    .format(resource_group, future.exception()))
            else:
                get_metrics_for_resources(ew, bearer_token, \
                    sub_url, resource_group, future.result())


def get_metrics_for_subscription(inputs, ew):
    """
        top level function
        given subscription id and credentials, get metrics for all resources with the right tags
        splunk sends an array of inputs, but only one element, hence the [0]
    """

    try:

        locale = "put_time_window"
        # update the time window for this iteration
        put_time_window(ew)

        locale = "put_time_checkpoint"
        # and update the checkpoint for next time
        put_time_checkpoint(ew)

        for input_name, input_item in inputs.inputs.iteritems():

            tenant_id = input_item["SPNTenantID"]
            spn_client_id = input_item["SPNApplicationId"]
            spn_client_secret = input_item["SPNApplicationKey"]
            subscription_id = input_item["SubscriptionId"]
            key_vault_name = input_item["vaultName"]
            secret_name = input_item["secretName"]
            secret_version = input_item["secretVersion"]

            locale = "get_access_token for key vault SPN"
            authentication_endpoint = "https://login.windows.net/"
            resource = 'https://vault.azure.net'
            kv_bearer_token = get_access_token( \
                tenant_id, \
                spn_client_id, \
                spn_client_secret, \
                authentication_endpoint, \
                resource)

            locale = "get_secret_from_keyvault"
            arm_creds = get_secret_from_keyvault(ew, kv_bearer_token, \
                key_vault_name, secret_name, secret_version)

            locale = "get_access_token"
            authentication_endpoint = get_azure_environment('Azure')['activeDirectoryEndpointUrl']
            resource = get_azure_environment('Azure')['activeDirectoryResourceId']
            bearer_token = get_access_token( \
                tenant_id, \
                arm_creds['spn_client_id'], \
                arm_creds['spn_client_secret'], \
                authentication_endpoint, \
                resource)

            locale = "get_azure_environment"
            resource_mgr_endpoint_url = get_azure_environment('Azure')['resourceManagerEndpointUrl']

            locale = "get_subscription_segment"
            sub_url = resource_mgr_endpoint_url + \
                get_subscription_segment(subscription_id)

            locale = "get_resources"
            resource_groups = get_resources(ew, bearer_token, sub_url)

            locale = "get_resources_for_rgs"
            get_resources_for_rgs(ew, bearer_token, sub_url, resource_groups)

    except:
        ew.log('ERROR', 'Error caught in get_metrics_for_subscription, type: {0}, value: {1}, locale = {2}'\
                .format(sys.exc_info()[0], sys.exc_info()[1], locale))

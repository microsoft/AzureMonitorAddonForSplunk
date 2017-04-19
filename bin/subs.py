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
import os
import json
import re
from concurrent import futures
import adal
import requests
from splunklib.modularinput import Event
from timewindow import get_time_window
from metricDefinitions import get_metric_definitions_for_resource_type, put_metric_definitions_for_resource_type

AZURE_API_VERSION_METRICS = '2016-09-01'
AZURE_API_VERSION_METRICS_DEFINITIONS = '2016-03-01'
AZURE_API_VERSION_COMPUTE = '2016-03-30'
AZURE_API_VERSION_RESOURCES = '2016-09-01'
AZURE_API_VERSION_KV = '2016-10-01'
ALL_AVAILABLE_METRICS = "All available metrics"

AZURE_ENVIRONMENTS = {
    "Azure": {
        "resourceManagerEndpointUrl": "https://management.azure.com",
        "activeDirectoryEndpointUrl": "https://login.microsoftonline.com/",
        "activeDirectoryResourceId": "https://management.core.windows.net/"
    },
    "China": {
        "resourceManagerEndpointUrl": "https://management.chinacloudapi.cn",
        "activeDirectoryEndpointUrl": "https://login.chinacloudapi.cn/",
        "activeDirectoryResourceId": "https://management.core.chinacloudapi.cn/"
    },
    "GovCloud": {
        "resourceManagerEndpointUrl": "https://management.usgovcloudapi.net",
        "activeDirectoryEndpointUrl": "https://login.microsoftonline.com/",
        "activeDirectoryResourceId": "https://management.core.usgovcloudapi.net/"
    },
    "BlackForest": {
        "resourceManagerEndpointUrl": "https://management.microsoftazure.de",
        "activeDirectoryEndpointUrl": "https://login.microsoftonline.de/",
        "activeDirectoryResourceId": "https://management.core.cloudapi.de/"
    }
}
__all__ = \
    [
        'get_access_token',
        'get_resources',
        'get_azure_environment',
        'get_subscription_segment',
        'get_metrics_for_resources'
    ]


def get_azure_environment(environment):
    """
        given environment name, return the base URL
    """
    azure_environment = AZURE_ENVIRONMENTS[environment]
    return azure_environment


def get_subscription_segment(subscription_id):
    """
        given a subscription id, return segment of resource id
    """
    subscription_segment = '/subscriptions/{0}'.format(subscription_id)
    return subscription_segment


def get_resource_group_segment(resource_group_name):
    """
        given a resource group name, return segment of resource id
    """
    resource_group_segment = '/resourceGroups/{0}'.format(resource_group_name)
    return resource_group_segment


def get_access_token(tenant_id, application_id, application_secret,
                     authentication_endpoint, resource):
    """
        get_access_token(tenant_id, application_id, application_secret)
        get an Azure access token using the adal library
    """
    context = adal.AuthenticationContext(
        authentication_endpoint + tenant_id, api_version=None)

    token_response = context.acquire_token_with_client_credentials(resource, application_id,
                                                                   application_secret)

    bearer_token = token_response.get('accessToken')

    return bearer_token


def get_secret_from_keyvault(ew, bearer_token, vault_name, secret_name, secret_version):
    '''
        get contents of the requested secret from a key vault
    '''
    url = 'https://{0}.vault.azure.net/secrets/{1}/{2}'\
        .format(vault_name, secret_name, secret_version)

    headers = {}
    headers["Content-Type"] = "application/json"
    headers["Authorization"] = " ".join(["Bearer", bearer_token])

    parameters = {'api-version': AZURE_API_VERSION_KV}

    response = requests.get(url,
                            params=parameters, headers=headers)

    response.raise_for_status()

    response_content = response.content
    content = json.loads(response_content)
    creds = {'spn_client_id': content['contentType'],
             'spn_client_secret': content['value']}

    return creds


def get_arm(ew, url, parameters, bearer_token):
    """
        execute an ARM api call
    """
    headers = {}
    headers["Content-Type"] = "application/json"
    headers["Authorization"] = " ".join(["Bearer", bearer_token])

    response = requests.get(url,
                            params=parameters, headers=headers)

    response.raise_for_status()

    try:
        response_json = response.json()
        value = response_json['value']
    except KeyError:
        value = 'get_arm: no value in response'
    except:
        ew.log('ERROR', 'Unexpected error: {0}'.format(sys.exc_info()[0]))

    return {'status_code': response.status_code, 'value': value, 'text': response.text}


def get_resources(ew, bearer_token, sub_url, resource_group_name=None):
    """
        Given environment & subscription_id, get list of resource groups
        Given the resource group name, get the list of resources in that group
    """

    url = sub_url
    if resource_group_name is None:
        url += '/resourceGroups'
    else:
        url += get_resource_group_segment(resource_group_name) + '/resources'

    parameters = {'api-version': AZURE_API_VERSION_RESOURCES}

    try:
        value = get_arm(ew, url, parameters, bearer_token)['value']
    except Exception as e:
        value = e.message

    return value


def get_requested_metrics(resource):
    """
        given a resource dict, see what metrics are requested by examining tags
    """
    # if no tags, skip it.
    try:
        tags = resource['tags']
    except KeyError:
        return None

    if len(tags) == 0:
        return None

    # if no metrics tag, skip it
    try:
        metrics_tag = tags['Metrics']
    except KeyError:
        return None

    if len(metrics_tag) == 0:
        return None

    set_of_requested_metrics = set()
    if metrics_tag == '*':
        metrics_tag = ALL_AVAILABLE_METRICS
    set_of_entered_metrics = set(metrics_tag.split(','))
    for metric in set_of_entered_metrics:
        set_of_requested_metrics.add(metric.strip())

    return set_of_requested_metrics


def get_index_resource_metrics(ew, bearer_token, sub_url, resource_rq, input_sourcetype, checkpoint_dir):
    """
        compare metrics requested (gotten from examining tags) to available metrics
        then go get the metrics in the intersection of those sets
    """
    sourcetypes = []
    try:
        filename = 'sourcetypes.json'
        with open(filename) as data_file:
            sourcetypes = json.load(data_file)
    except Exception as e:
        ew.log(
            'ERROR', 'current working directory is: {0}'.format(os.getcwd()))
        ew.log('ERROR', e)
    #ew.log('DEBUG', 'SourceTypes list is: {0}'.format(sourcetypes))

    list_of_metrics = []
    try:
        set_of_available_metrics = get_set_of_available_metrics(
            ew, bearer_token, sub_url, resource_rq['resource_group_name'], resource_rq['resource'])

        # in this case, the user tagged a resource that returns no metrics,
        # or requested a metric by name that doesn't exist
        if set_of_available_metrics == set():
            return []

        set_of_requested_metrics = resource_rq['metrics_rq']

        set_of_metrics_to_get = set()
        # metrics to get = intersection of those available with those requested
        if set_of_requested_metrics.issubset({ALL_AVAILABLE_METRICS}):
            set_of_metrics_to_get = set_of_available_metrics.copy()
        else:
            set_of_metrics_to_get = set_of_available_metrics.intersection(
                set_of_requested_metrics)

        ew.log('DEBUG', 'getting list of metrics for: {0}'.format(
            resource_rq['resource']))

        list_of_metrics = get_metrics_to_get(ew, bearer_token, sub_url,
                                             resource_rq['resource_group_name'], resource_rq['resource'],
                                             set_of_metrics_to_get, checkpoint_dir)
    except Exception as e:
        ew.log('ERROR', 'get_index_resource_metrics area 1: {0}'.format(e))

    for metric in list_of_metrics:

        resource_id = metric['id'].upper()

        re_sub = re.compile(r"SUBSCRIPTIONS\/(.*?)\/")
        try:
            subscription_id = re_sub.search(resource_id).group(1)
        except IndexError:
            subscription_id = ''
        except:
            ew.log('ERROR',
                   'Regex parsing subscription_id failed with error: {0}'.format(sys.exc_info()[0]))

        re_rg = re.compile(r"SUBSCRIPTIONS\/(?:.*?)\/RESOURCEGROUPS\/(.*?)\/")
        try:
            resource_group = re_rg.search(resource_id).group(1)
        except IndexError:
            resource_group = ''
        except:
            ew.log('ERROR',
                   'Regex parsing resource_id failed with error: {0}'.format(sys.exc_info()[0]))

        # test for databases
        re_rtd = re.compile(
            r"PROVIDERS\/(.*?\/.*?)(?:\/)(?:.*\/)(.*DATABASES)")
        try:
            group1 = re_rtd.search(resource_id).group(1)
            group2 = re_rtd.search(resource_id).group(2)
            ew.log('DEBUG', 'group 1: {0}'.format(group1))
            ew.log('DEBUG', 'group 2: {0}'.format(group2))
            if group2 in ['DATABASES']:
                resource_type = '/'.join((group1, group2))

        except (IndexError, AttributeError):
            resource_type = ''
        except:
            ew.log('ERROR',
                   'Regex parsing database resource_type failed with error: {0}'
                   .format(sys.exc_info()[0]))

        if resource_type == '':
            re_rt = re.compile(r"PROVIDERS\/(.*?\/.*?)(?:\/)")
            try:
                resource_type = re_rt.search(resource_id).group(1)
            except IndexError:
                resource_type = ''
            except:
                ew.log('ERROR',
                       'Regex parsing resource_type failed with error: {0}'
                       .format(sys.exc_info()[0]))

        re_rn = re.compile(r"PROVIDERS\/(?:.*?\/.*?\/)(.*?)(?:\/|$)")
        try:
            resource_name = re_rn.search(resource_id).group(1)
        except IndexError:
            resource_name = ''
        except:
            ew.log('ERROR',
                   'Regex parsing resource_name failed with error: {0}'
                   .format(sys.exc_info()[0]))

        metric.update({
            'amm_subscription_id': subscription_id,
            'amm_resourceGroup': resource_group,
            'amm_resourceType': resource_type,
            'amm_resourceName': resource_name
        })

        sourcetype = input_sourcetype
        if not resource_type is None:
            try:
                sourcetype = sourcetypes[resource_type]
                ew.log('DEBUG', 'found sourcetype: {0}'
                       .format(sourcetype))
            except AttributeError:
                sourcetype = input_sourcetype
                ew.log('ERROR',
                       'Resource_type: {0}, resource_id: {1}, error: {2}'
                       .format(resource_type, resource_id, sys.exc_info()[0]))
            except KeyError:
                sourcetype = input_sourcetype
                ew.log('WARN',
                       'Resource_type: {0}, missing from sourcetypes.json.'
                       .format(resource_type))
            except:
                ew.log('ERROR', 'Resource_type: {0}, some other error: {1}'
                       .format(resource_type, sys.exc_info()[0]))
        else:
            ew.log('DEBUG', 'Resource_type is None, resource_id: {0}'
                   .format(resource_id))

        try:
            # metric['data'] is an array of dict. pop it, then index using the dicts
            # within the array, rather than one event with all of the dicts
            datalist = metric.pop('data')
            for dataitem in datalist:

                metric['data'] = dataitem

                # convert it to something that Splunk likes
                data_point_json = json.dumps(metric)

                ew.log('DEBUG', 'Azure Monitor Metrics: Index data point: {0}, to sourcetype: {1}'
                       .format(data_point_json, sourcetype))

                # index the event
                my_event = Event(sourcetype=sourcetype, data=data_point_json)
                try:
                    ew.write_event(my_event)
                except Exception as ex:
                    raise ex
        except Exception as e:
            ew.log('ERROR', 'Error caught indexing the data: {0}'
                   .format(e))


def get_metrics_for_resources(ew, bearer_token, sub_url,
                              resource_group_name, resources, input_sourcetype, checkpoint_dir):
    """
        resources is a list of dict, where the dict is the resource details with
        name, type, id, tags, etc.
    """
    list_of_requested_metrics = []
    for resource in resources:
        set_of_requested_metrics = get_requested_metrics(resource)

        if set_of_requested_metrics is None:
            continue

        list_of_requested_metrics.append(
            {'resource_group_name': resource_group_name,
             'resource': resource,
             'metrics_rq': set_of_requested_metrics})

    with futures.ThreadPoolExecutor(max_workers=5) as executor:
        metrics_future = dict((executor.submit(
            get_index_resource_metrics, ew, bearer_token, sub_url, rq, input_sourcetype, checkpoint_dir), rq)
            for rq in list_of_requested_metrics)

        for future in futures.as_completed(metrics_future, None):
            resource = metrics_future[future]
            if future.exception() is not None:
                ew.log('ERROR', 'resource {0} generated an exception: {1}'
                       .format(resource, future.exception()))


def get_set_of_available_metrics(ew, bearer_token, sub_url,
                                 resource_group_name, resource):
    """
        given the resource record, get the metrics that are available for that resource
    """
    set_of_available_metrics = set()

    metrics = get_metric_definitions_for_resource_type(ew, resource['type'])
    if metrics is None:
        ew.log('DEBUG', 'QUERYING for metric definitions for type: {0}'.format(resource['type']))

        url_base_resource_group = sub_url + \
            get_resource_group_segment(resource_group_name)

        url_metrics_definitions = url_base_resource_group + \
            build_resource_path(resource['type'], resource['name']) + \
            '/providers/microsoft.insights/metricDefinitions'

        parameters = {'api-version': AZURE_API_VERSION_METRICS_DEFINITIONS}

        try:
            response = get_arm(ew, url_metrics_definitions, parameters, bearer_token)
        except Exception as e:
            ew.log('ERROR', 'get_arm raised error getting metrics definitions: {0}, url: {1}'
                   .format(e, url_metrics_definitions))

        metrics = []
        for metric in response['value']:
            metrics.append(metric['name']['value'])

        put_metric_definitions_for_resource_type(ew, resource['type'], {'metrics': metrics})

    for metric in metrics:
        set_of_available_metrics.add(metric)

    return set_of_available_metrics


def get_metrics_to_get(ew, bearer_token, sub_url,
                       resource_group_name, resource, set_of_metrics_to_get, checkpoint_dir):
    """
        given the resource record, get the metrics that are available for that resource
    """
    url_base_resource_group = sub_url + \
        get_resource_group_segment(resource_group_name)

    url_metrics = url_base_resource_group + \
        build_resource_path(resource['type'], resource['name']) + \
        '/providers/microsoft.insights/metrics'

    # query string / metric names
    metrics_names = ''
    for metric_to_get in set_of_metrics_to_get:
        if len(metrics_names) > 0:
            metrics_names += ' or '
        metrics_names += "name.value eq '{0}'".format(metric_to_get)
    metrics_names = '(' + metrics_names + ')'

    # query string / time window
    time_window = get_time_window(ew, checkpoint_dir)

    parameters = {'api-version': AZURE_API_VERSION_METRICS}
    parameters.update({'$filter': metrics_names + time_window})

    try:
        value = get_arm(ew, url_metrics, parameters, bearer_token)['value']
    except Exception as e:
        ew.log(
            'ERROR', 'get_metrics_to_get: Error returned from get_arm: {0}'.format(e))
        value = []

    return value


def build_resource_path(resource_type, resource_name):
    '''
        resource_type could be in one of these two categories:
            1. Microsoft.Compute/virtualMachines (one level of type)
                in which case resource_name is one level (e.g. devbox)

                In this case, the path to the resource is like this:

                /providers/Microsoft.Compute/virtualMachines/devbox

            2. Microsoft.Sql/servers/databases (two levels of type)
                in which case resource_name is two levels (e.g. goliveSqlServer/goliveDatabase)

                In this case, the path to the resource is like this:

                /providers/Microsoft.Sql/servers/goliveSqlServer/databases/goliveDatabase

    '''

    # split the strings
    resource_types = resource_type.split('/')
    resource_names = resource_name.split('/')

    path = '/providers'

    index = 0

    while index < len(resource_types):

        if index == 0:
            path += '/' + resource_types[index]
            index += 1
            continue

        path += '/' + resource_types[index] + '/' + resource_names[index - 1]
        index += 1

    return path

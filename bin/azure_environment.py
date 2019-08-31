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
import os

def set_azure_environment():
    '''
    # AZURE_ENVIRONMENT tells the add-on which cloud you're operating in
    #
    # valid values are:
    #
    # AzureCloud        = public Azure 
    # AzureUSGovernment = US government clouds, including DoD
    # AzureChinaCloud   = China's sovereign cloud
    # AzureGermanCloud  = Germany's sovereign cloud
    #
    # edit the following line, inserting the name of the cloud you're operating in:
    '''
    os.environ['AZURE_ENVIRONMENT'] = "AzureCloud"

"""
Do not edit below this line
"""

def get_azure_environment():
    """
        given environment name, return the base URL
    """
    environment = os.getenv("AZURE_ENVIRONMENT", "AzureCloud")
    azure_environment = AZURE_ENVIRONMENTS[environment]
    return azure_environment

AZURE_ENVIRONMENTS = {
    "AzureCloud": {
        "resourceManagerEndpointUrl": "https://management.azure.com",
        "activeDirectoryEndpointUrl": "https://login.microsoftonline.com/",
        "activeDirectoryResourceId": "https://management.core.windows.net/",
        "keyvaultDns": ".vault.azure.net",
        "keyvaultResource": "https://vault.azure.net"
    },
    "AzureChinaCloud": {
        "resourceManagerEndpointUrl": "https://management.chinacloudapi.cn",
        "activeDirectoryEndpointUrl": "https://login.chinacloudapi.cn/",
        "activeDirectoryResourceId": "https://management.core.chinacloudapi.cn/",
        "keyvaultDns": ".vault.azure.cn",
        "keyvaultResource": "https://vault.azure.cn"
    },
    "AzureUSGovernment": {
        "resourceManagerEndpointUrl": "https://management.usgovcloudapi.net",
        "activeDirectoryEndpointUrl": "https://login.microsoftonline.com/",
        "activeDirectoryResourceId": "https://management.core.usgovcloudapi.net/",
        "keyvaultDns": ".vault.usgovcloudapi.net",
        "keyvaultResource": "https://vault.usgovcloudapi.net"
    },
    "AzureGermanCloud": {
        "resourceManagerEndpointUrl": "https://management.microsoftazure.de",
        "activeDirectoryEndpointUrl": "https://login.microsoftonline.de/",
        "activeDirectoryResourceId": "https://management.core.cloudapi.de/",
        "keyvaultDns": ".vault.microsoftazure.de",
        "keyvaultResource": "https://vault.microsoftazure.de"
    }
}


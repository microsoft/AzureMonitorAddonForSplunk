# encoding = utf-8
'''
#
# AzureMonitorAddonForSplunk
#
# Copyright (c) Microsoft Corporation
#
# All rights reserved.
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the ""Software""), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is furnished
# to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
# FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
# COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
# IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
# WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
#
'''
import argparse
import splunklib.client as client

def mask_password(\
    name, session_key, tenant_id, app_id, \
    app_key, event_hub_namespace, vault_name, \
    secret_name, secret_version):
    '''
        modify contents of launcher's inputs.conf
    '''
    try:
        token = {'token': session_key}
        service = client.connect(**token)
        kind, input_name = name.split("://")
        item = service.inputs.__getitem__((input_name, kind))

        kwargs = {
            'vaultName': vault_name,
            'SPNTenantID': tenant_id,
            'SPNApplicationId': app_id,
            'SPNApplicationKey': app_key,
            'eventHubNamespace': event_hub_namespace,
            'secretName': secret_name,
            'secretVersion': secret_version,
            'index': item.content.index,
            'interval': item.content.interval,
            'sourcetype': item.content.sourcetype
        }

        item.update(**kwargs).refresh()

    except Exception as e:
        print "azure_diagnostic_logs: Error updating inputs.conf: %s" % str(e)

def main():
    '''
        parse arguments and call the required function
    '''
    parser = argparse.ArgumentParser(description='modify values in inputs.conf')
    parser.add_argument('-n', type=str, required=True, dest='data_input_name')
    parser.add_argument('-k', type=str, required=True, dest='session_key')
    parser.add_argument('-p1', type=str, required=True, dest='tenant_id')
    parser.add_argument('-p2', type=str, required=True, dest='app_id')
    parser.add_argument('-p3', type=str, required=True, dest='app_key')
    parser.add_argument('-p4', type=str, required=True, dest='event_hub_namespace')
    parser.add_argument('-p5', type=str, required=True, dest='vault_name')
    parser.add_argument('-p6', type=str, required=True, dest='secret_name')
    parser.add_argument('-p7', type=str, required=True, dest='secret_version')
    args = parser.parse_args()

    mask_password(args.data_input_name, args.session_key, args.tenant_id, args.app_id, \
                  args.app_key, args.event_hub_namespace, args.vault_name, args.secret_name, \
                  args.secret_version)

if __name__ == "__main__":
    main()

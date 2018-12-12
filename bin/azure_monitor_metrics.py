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
from splunklib.modularinput import Script, Scheme, Argument
from azure_monitor_metrics_main import get_metrics_for_subscription
from azure_monitor_metrics_main import get_or_store_secrets
class AzureMonitorMetrics(Script):
    '''
        entry point for add-on
    '''
    def get_scheme(self):
        scheme = Scheme("Azure Monitor Metrics")
        scheme.description = "Streams events from Azure resources via Azure Monitor REST API."
        scheme.use_external_validation = True
        scheme.use_single_instance = False

        arg2 = Argument("SPNTenantID")
        arg2.data_type = Argument.data_type_string
        arg2.required_on_create = False
        arg2.required_on_edit = False
        scheme.add_argument(arg2)

        arg3 = Argument("SPNApplicationId")
        arg3.data_type = Argument.data_type_string
        arg3.required_on_create = False
        arg3.required_on_edit = False
        scheme.add_argument(arg3)

        arg4 = Argument("SPNApplicationKey")
        arg4.data_type = Argument.data_type_string
        arg4.required_on_create = False
        arg4.required_on_edit = False
        scheme.add_argument(arg4)

        arg1 = Argument("SubscriptionId")
        arg1.data_type = Argument.data_type_string
        arg1.required_on_create = True
        arg1.required_on_edit = True
        scheme.add_argument(arg1)

        arg5 = Argument("vaultName")
        arg5.data_type = Argument.data_type_string
        arg5.required_on_create = False
        arg5.required_on_edit = False
        scheme.add_argument(arg5)

        arg6 = Argument("secretName")
        arg6.data_type = Argument.data_type_string
        arg6.required_on_create = False
        arg6.required_on_edit = False
        scheme.add_argument(arg6)

        arg7 = Argument("secretVersion")
        arg7.data_type = Argument.data_type_string
        arg7.required_on_create = False
        arg7.required_on_edit = False
        scheme.add_argument(arg7)

        arg8 = Argument("metricsTagKey")
        arg8.data_type = Argument.data_type_string
        arg8.required_on_create = False
        arg8.required_on_edit = False
        scheme.add_argument(arg8)

        arg9 = Argument("ignoreTagValue")
        arg9.data_type = Argument.data_type_boolean
        arg9.required_on_create = False
        arg9.required_on_edit = False
        scheme.add_argument(arg9)

        return scheme

    def validate_input(self, validation_definition):
        pass

    def stream_events(self, inputs, ew):

        def logger(severity, message):
            '''
                abstract logging from ew
            '''
            ew.log(severity, message)

        logger('DEBUG', 'Azure Monitor Metrics stream_events starting.')

        try:
            # put myself into the right directory for grabbing config file
            dir_path = os.path.dirname(os.path.realpath(__file__))
            os.chdir(dir_path)

            # go do the password dance
            credentials = get_or_store_secrets(self, inputs, logger)

            # go do the work
            get_metrics_for_subscription(inputs, credentials, ew)

        except:
            logger('ERROR', 'Error caught in stream_events, type: {0}, value: {1}'\
                .format(sys.exc_info()[0], sys.exc_info()[1]))

        logger('DEBUG', 'Azure Monitor Metrics stream_events finishing.')

if __name__ == "__main__":
    sys.exit(AzureMonitorMetrics().run(sys.argv))

# encoding = utf-8
"""
    launch test of azure_monitor_metrics.py 
"""
import sys
import site
sys.path.append('c:\\splunk-sdk-python')
sys.path.append('c:\\github\\AzureMonitorAddOnForSplunk\\bin')

import os
from splunklib.modularinput import InputDefinition
from azure_monitor_metrics_main import get_metrics_for_subscription
import json

class ew_class:
    '''
        mock the event writer class
    '''
    log_level = 'WARN'
    def log(self, severity, message):
        '''
            Mock the Splunk event writer
        '''
        if severity == 'DEBUG' and self.log_level != 'DEBUG':
            return

        print '{0} - {1}'.format(severity, message)

    def write_event(self, my_event):
        '''
            mock the splunk write_event method
        '''
        pass

    def __init__(self):
        pass

if __name__ == '__main__':

    # put myself into the test directory
    os.chdir('c:\\github\\AzureMonitorAddonForSplunk\\test')

    with open('secrets.json') as data_file:
        creds = json.load(data_file)

    # put myself into the right directory for grabbing config file
    os.chdir('c:\\github\\AzureMonitorAddonForSplunk\\bin')

    my_ew = ew_class()
    my_input = InputDefinition()
    my_input.inputs = {0: creds}
    my_input.metadata = {'checkpoint_dir':'c:\\github\\AzureMonitorAddonForSplunk\\test'}

    app_id = creds['SPNApplicationId']
    app_key = creds['SPNApplicationKey']

    # import metricDefinitions as m
    # resource_type = 'Microsoft.Web/xxxx'
    # definitions = m.get_metric_definitions_for_resource_type(my_ew, resource_type)
    # if definitions is None:
    #     defs = list()
    #     defs.append('Http404')
    #     defs.append('Http403')
    #     m.put_metric_definitions_for_resource_type(my_ew, resource_type, {'metrics': defs})

    get_metrics_for_subscription(my_input, app_id, app_key, my_ew)

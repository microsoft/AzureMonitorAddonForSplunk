# encoding = utf-8
"""
    launch test of timewindow.py
"""

import sys
import os
sys.path.append('c:\\github\\AzureMonitorAddonForSplunk\\bin')
import timewindow as tw

class ew_class:
    '''
        mock the event writer class
    '''
    log_level = 'DEBUG'
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

    # put myself into the right directory for grabbing config file
    os.chdir('c:\\github\\AzureMonitorAddonForSplunk\\bin')

    myEw = ew_class()
    tw.put_time_checkpoint(myEw)
    d = tw.get_time_checkpoint(myEw)
    tw.put_time_window(myEw)

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
import time

def get_time_window(ew):
    '''
        get the current time window. time window is calculated on entry to this iteration of
        the add-on. in the routine that indexes metrics, the time window is retrieved. same
        time window is used for the entire iteration.
    '''
    try:
        with open('timewindow.txt') as data_file:
            time_window = data_file.read()
    except Exception as err:
        ew.log('ERROR', 'Could not get time window, error: {0}'.format(err))

    return time_window

def put_time_window(ew):
    '''
        create and write new time window, where now is the ending time
        and then is the checkpoint (earlier) time
    '''
    now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time()))
    then = get_time_checkpoint(ew)
    time_window = ' and startTime eq {0} and endTime eq {1}'.format(then, now)

    try:
        with open('timewindow.txt', 'w') as data_file:
            data_file.write(time_window)
    except Exception as err:
        ew.log('ERROR', 'Could not write time window, error: {0}'.format(err))


def put_time_checkpoint(ew):
    '''
        update the time checkpoint
    '''
    now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time()))

    try:
        with open('timecheckpoint.txt', 'w') as data_file:
            data_file.write(now)
    except Exception as err:
        ew.log('ERROR', 'Could not write time checkpoint, error: {0}'.format(err))


def get_time_checkpoint(ew):
    '''
        The time checkpoint is a formatted time string. Initialize it with now.
    '''
    try:
        with open('timecheckpoint.txt') as data_file:
            time_checkpoint = data_file.read()
    except IOError:
        time_checkpoint = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time()))

    return time_checkpoint

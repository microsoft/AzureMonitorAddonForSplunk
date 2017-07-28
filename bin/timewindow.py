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
from datetime import datetime, timedelta as td
import json

def get_time_window(event_writer, checkpoint_dict):
    '''
        get the current time window. time window is calculated on entry to this iteration of
        the add-on. in the routine that indexes metrics, the time window is retrieved. same
        time window is used for the entire iteration.
    '''
    filename = timewindow_file_name(checkpoint_dict)

    try:
        with open(filename) as data_file:
            time_window = data_file.read()
    except Exception as err:
        event_writer.log('ERROR', 'Could not get time window, error: {0}'.format(err))

    return time_window

def put_time_window(event_writer, checkpoint_dict):
    '''
        Azure writes metrics a bit time-lagged. If the time window is 60
        seconds ending now, chances are that the metric hasn't arrived.

        Create and write new time window, where now - 60 is the ending time
        and then is the checkpoint (earlier) time - 60
    '''
    end_time = datetime.utcnow() - td(seconds=60)
    start_time = get_time_checkpoint(event_writer, checkpoint_dict) - td(seconds=60)
    if start_time + td(seconds=60) > end_time:
        end_time = start_time + td(seconds=60)

    time_window = ' and startTime eq {0} and endTime eq {1}'\
        .format(start_time.strftime('%Y-%m-%dT%H:%M:%SZ'), \
                end_time.strftime('%Y-%m-%dT%H:%M:%SZ'))

    filename = timewindow_file_name(checkpoint_dict)

    try:
        with open(filename, 'w') as data_file:
            data_file.write(time_window)
    except Exception as err:
        event_writer.log('ERROR', 'Could not write time window, error: {0}'.format(err))


def put_time_checkpoint(event_writer, checkpoint_dict):
    '''
        update the time checkpoint. it is a serialized datetime.
    '''
    now = datetime.utcnow()
    serialized = {
        'year': now.year,
        'month': now.month,
        'day': now.day,
        'hour': now.hour,
        'minute': now.minute,
        'second': now.second,
        'microsecond': now.microsecond
    }

    filename = checkpoint_file_name(checkpoint_dict)

    try:
        with open(filename, 'w') as data_file:
            data_file.write(json.dumps(serialized))
    except Exception as err:
        event_writer.log('ERROR', 'Could not write time checkpoint, error: {0}'.format(err))


def get_time_checkpoint(event_writer, checkpoint_dict):
    '''
        The time checkpoint is a serialized datetime. Initialize it with now.
    '''
    filename = checkpoint_file_name(checkpoint_dict)

    try:
        with open(filename) as data_file:
            d = json.loads(data_file.read())
        time_checkpoint = datetime(d['year'], d['month'], d['day'], \
            d['hour'], d['minute'], d['second'], d['microsecond'])
    except IOError:
        time_checkpoint = datetime.utcnow()

    return time_checkpoint

def checkpoint_file_name(checkpoint_dict):
    '''
    build & return file name of the checkpoint file
    '''
    return os.path.join(checkpoint_dict["checkpoint_dir"], checkpoint_dict["instance_name"] + '_timecheckpoint.txt')

def timewindow_file_name(checkpoint_dict):
    '''
    build & return file name of the timewindow file
    '''
    return os.path.join(checkpoint_dict["checkpoint_dir"], checkpoint_dict["instance_name"] + '_timewindow.txt')

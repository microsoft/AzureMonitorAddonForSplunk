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
import sys
import json
import threading

__METRIC_DEFINITIONS__ = None
__FILENAME__ = 'metricDefinitions.json'

def load_metric_definitions(event_writer):
    '''
        get cached metric definitions from disk
    '''
    global __METRIC_DEFINITIONS__
    try:
        with open(__FILENAME__) as data_file:
            __METRIC_DEFINITIONS__ = json.load(data_file)
    except Exception as e:
        __METRIC_DEFINITIONS__ = {}
        event_writer.log('WARN', e)


def save_metric_definitions(event_writer):
    '''
        put __METRIC_DEFINITIONS__ back on the disk
    '''
    global __METRIC_DEFINITIONS__
    try:
        with open(__FILENAME__, 'w') as outfile:
            json.dump(__METRIC_DEFINITIONS__, outfile)
    except Exception as e:
        event_writer.log('ERROR', e)


def get_metric_definitions_for_resource_type(event_writer, resource_type):
    '''
        pass in a resourceType, get back the cached metric definitions
        returns [] if not cached
    '''
    global __METRIC_DEFINITIONS__
    if __METRIC_DEFINITIONS__ is None:
        load_metric_definitions(event_writer)

    try:
        definitions = __METRIC_DEFINITIONS__[resource_type]['metrics']
    except KeyError:
        definitions = None

    return definitions


def put_metric_definitions_for_resource_type(event_writer, resource_type, definitions):
    '''
        given a resourceType and a list of metric definitions, update
        the cached list
    '''
    global __METRIC_DEFINITIONS__
    try:
        __METRIC_DEFINITIONS__[resource_type] = definitions
        save_metric_definitions(event_writer)
    except Exception as e:
        event_writer.log('ERROR', e)

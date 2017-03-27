//      
//      [SplunkAddOnForAzureMonitorLogs]
// 
//      The MIT License (MIT)
//
//      Copyright (c) 2017 Microsoft. All rights reserved.
//
//      Permission is hereby granted, free of charge, to any person obtaining a copy
//      of this software and associated documentation files (the "Software"), to deal
//      in the Software without restriction, including without limitation the rights
//      to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//      copies of the Software, and to permit persons to whom the Software is
//      furnished to do so, subject to the following conditions:
//
//      The above copyright notice and this permission notice shall be included in
//      all copies or substantial portions of the Software.
//
//      THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//      IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//      FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//      AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//      LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//      OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//      THE SOFTWARE.
//
var splunkjs = require("splunk-sdk");
var ModularInputs = splunkjs.ModularInputs;
var Logger = ModularInputs.Logger;
var path = require('path');
var Promise = require('bluebird');
var fs = require('fs');

var checkpointFileLocation = path.join(process.env.SPLUNK_DB, 'modinputs', 'azure_monitor_logs');
var checkpointFileName = path.join(checkpointFileLocation, 'checkpoints.json');

exports.getCheckpoints = function (hub, idx, offset) {

    try {
        //Logger.debug('azure_monitor_activity_logs', 'Making checkpoint file directory: ' + checkpointFileLocation);
        fs.mkdirSync(checkpointFileLocation);
    } catch (err) {
        if (err.code === 'EEXIST') { }
        else {
            Logger.debug('azure_monitor_activity_logs', 'Caught error making the checkpoint file directory: ' + err);
        }
    }

    var checkpointsData = "{}";
    try {
        //Logger.debug('azure_monitor_activity_logs', 'Reading contents of checkpoint file.');
        checkpointsData = fs.readFileSync(checkpointFileName, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') { }
        else {
            Logger.debug('azure_monitor_activity_logs', 'Caught error reading checkpoint file: ' + err);
            checkpointsData = "{}"
        }
    }
    checkpoints = JSON.parse(checkpointsData);

    return checkpoints;
}

exports.putCheckpoints = function (err, checkpoints) {

    try {
        //Logger.debug('azure_monitor_activity_logs', 'Writing checkpoint file');
        fs.writeFileSync(checkpointFileName, JSON.stringify(checkpoints));
    } catch (err) {
        Logger.debug('azure_monitor_activity_logs', 'Caught error writing checkpoint file: ' + err);
    }

}
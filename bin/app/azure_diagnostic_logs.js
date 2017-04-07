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

/* jshint unused: true */

(function () {

    var splunkjs = require("splunk-sdk");
    var ModularInputs = splunkjs.ModularInputs;
    var logs = require('./azure_monitor_logs');
    var Logger = ModularInputs.Logger;
    var strings = require('./strings');
    strings.stringFormat();

    exports.getScheme = function () {
        var schemeName = 'Azure Monitor Diagnostic Logs';
        var schemeDesc = 'Diagnostic Logs obtained via Azure Monitor.';

        return logs.getScheme(schemeName, schemeDesc);
    };

    // validateInput method validates the script's configuration (optional)
    exports.validateInput = function (definition, done) {
        done();
    };

    exports.streamEvents = function (name, singleInput, eventWriter, done) {

        logs.getOrStoreSecrets(name, singleInput, function(err, results) {

            mySingleInput = results;

            Logger.debug(name, String.format('single input = {0}', JSON.stringify(mySingleInput)));

            if (err) {

            } else {
                logs.streamEvents(name, mySingleInput, eventWriter, function () {
                    done();
                });
            }
        });
    };

    ModularInputs.execute(exports, module);
})();
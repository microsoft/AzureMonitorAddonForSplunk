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

(function() {
    var splunkjs        = require("splunk-sdk");
    var ModularInputs   = splunkjs.ModularInputs;
    var Logger          = ModularInputs.Logger;
    var Event           = ModularInputs.Event;
    var Scheme          = ModularInputs.Scheme;
    var Argument        = ModularInputs.Argument;

    // other global variables here
    var logs = require('./azure_monitor_logs.js');
    var subs = require('./subs');
    subs.stringFormat();

    exports.getScheme = function () {
        var scheme = new Scheme("Azure Monitor Logs");

        // scheme properties
        scheme.description = "Diagnostic Logs obtained from Azure Monitor.";
        scheme.useExternalValidation = true;  // if true, must define validateInput method
        scheme.useSingleInstance = false;      // if true, all instances of mod input passed to
        //   a single script instance; if false, user 
        //   can set the interval parameter under "more settings"

        // add arguments
        scheme.args = [
            new Argument({
                name: "SPNName",
                dataType: Argument.dataTypeString,
                description: "Service principal application id (aka client id).",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "SPNPassword",
                dataType: Argument.dataTypeString,
                description: "Service principal password (aka client secret).",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "SPNTenantID",
                dataType: Argument.dataTypeString,
                description: "Azure AD tenant containing the service principal.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "eventHubNamespace",
                dataType: Argument.dataTypeString,
                description: "Azure Event Hub namespace.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "vaultName",
                dataType: Argument.dataTypeString,
                description: "Key vault name.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "secretName",
                dataType: Argument.dataTypeString,
                description: "Name of the secret containing SAS key & value.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "secretVersion",
                dataType: Argument.dataTypeString,
                description: "Version of the secret containing SAS key & value.",
                requiredOnCreate: true,
                requiredOnEdit: false
            })
            // other arguments here
        ];

        return scheme;
    };

    // validateInput method validates the script's configuration (optional)
    exports.validateInput = function(definition, done) {
        done();
    };

    // streamEvents streams the events to Splunk Enterprise
    exports.streamEvents = function(name, singleInput, eventWriter, done) {
        
        var messageHandler = function (data) {

            Logger.debug(name, String.format('streamEvents.messageHandler got data'));
            var curEvent = new Event({
                stanza: name,
                data: data
            });

            try {
                eventWriter.writeEvent(curEvent);
                Logger.debug(name, String.format('streamEvents.messageHandler wrote an event'));
            }
            catch (e) {
                errorFound = true; // Make sure we stop streaming if there's an error at any point
                Logger.error(name, e.message);
                done(e);

                // we had an error; die
                return;
            }

        };

        logs.streamEvents(name, singleInput, messageHandler, function() {
            done();
        });
        
    };

    ModularInputs.execute(exports, module);
})();
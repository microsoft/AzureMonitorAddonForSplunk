//
// SplunkAddOnForAzureMonitorLogs
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
(function () {
    var splunkjs = require("splunk-sdk");
    var ModularInputs = splunkjs.ModularInputs;
    var Logger = ModularInputs.Logger;
    var Event = ModularInputs.Event;
    var Scheme = ModularInputs.Scheme;
    var Argument = ModularInputs.Argument;
    var _ = require('underscore');

    // other global variables here
    var logs = require('./azure_monitor_logs');
    var subs = require('./subs');
    var strings = require('./strings');
    strings.stringFormat();
    var categories = require('./logCategories.json');

    exports.getScheme = function () {
        var scheme = new Scheme("Azure Monitor Activity Log");

        // scheme properties
        scheme.description = "Activity Log (aka Audit Log) obtained from Azure Monitor.";
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
    exports.validateInput = function (definition, done) {
        done();
    };

    // streamEvents streams the events to Splunk Enterprise
    exports.streamEvents = function (name, singleInput, eventWriter, done) {

        var messageHandler = function (data) {

            var dataAsString = JSON.stringify(data);
            Logger.debug(name, String.format('streamEvents.messageHandler got data for data input named: {0}', name));
            //Logger.debug(name, String.format('{0}', dataAsString));

            var resourceId = data.resourceId.toUpperCase() || '';
            var subscriptionId = '';
            var resourceGroup = '';
            var resourceName = '';
            var resourceType = '';
            if (resourceId.length > 0) {
                var match = resourceId.match('SUBSCRIPTIONS\/(.*?)\/');
                if (!_.isNull(match)) {
                    subscriptionId = match[1];
                    data.am_subscriptionId = subscriptionId;
                }
                match = resourceId.match('SUBSCRIPTIONS\/(?:.*?)\/RESOURCEGROUPS\/(.*?)\/');
                if (!_.isNull(match)) {
                    resourceGroup = match[1];
                    data.am_resourceGroup = resourceGroup;
                }
                match = resourceId.match('PROVIDERS\/(.*?\/.*?)(?:\/)');
                if (!_.isNull(match)) {
                    resourceType = match[1];
                    data.am_resourceType = resourceType;
                }
                match = resourceId.match('PROVIDERS\/(?:.*?\/.*?\/)(.*?)(?:\/|$)');
                if (!_.isNull(match)) {
                    resourceName = match[1];
                    data.am_resourceName = resourceName;
                }
            }

            if (~name.indexOf('azure_activity_log:')) {
                var sourcetype = 'amal:activityLog';
            } else {
                var sourcetype = 'amdl:diagnosticLogs';

                var category = data.category.toUpperCase() || '';
                if (resourceType != '') {
                    var testSourceType = categories[resourceType + '/' + category];
                    if (!_.isUndefined(testSourceType) && testSourceType.length > 0) {
                        sourcetype = testSourceType;
                    }
                }
            }

            Logger.debug(name, String.format('Subscription ID: {0}, resourceType: {1}, resourceName: {2}, sourcetype: {3}',
                subscriptionId, resourceType, resourceName, sourcetype));

            var curEvent = new Event({
                stanza: name,
                sourcetype: sourcetype,
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

        logs.streamEvents(name, singleInput, messageHandler, function () {
            done();
        });

    };

    ModularInputs.execute(exports, module);
})();
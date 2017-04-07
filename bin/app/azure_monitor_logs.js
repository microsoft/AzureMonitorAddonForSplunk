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

/* jshint unused: true */

var splunkjs = require("splunk-sdk");
var ModularInputs = splunkjs.ModularInputs;
var ModularInput = ModularInputs.ModularInput;
var Logger = ModularInputs.Logger;
var Scheme = ModularInputs.Scheme;
var Event = ModularInputs.Event;
var Argument = ModularInputs.Argument;

var _ = require('underscore');
var AMQPClient = require('amqp10').Client;
var Policy = require('amqp10').Policy;
var Promise = require('bluebird');

var subs = require('./subs');
var strings = require('./strings');
strings.stringFormat();
var allHubs = require('./hubs.json');
var categories = require('./logCategories.json');
var spawnSync = require("child_process").spawnSync;
var async = require('async');

var secretMask = '********';

exports.getOrStoreSecrets = function (name, singleInput, done) {

    // make a copy of singleInput
    var mySingleInput = JSON.parse(JSON.stringify(singleInput));

    var inputDefinition = ModularInput._inputDefinition;
    var session_key = inputDefinition.metadata.session_key;
    var service = new splunkjs.Service({ sessionKey: session_key });
    var storagePasswords = service.storagePasswords({ 'app': 'TA-Azure_Monitor' });

    var propsAppId = {};
    var propsAppKey = {};
    if (~name.indexOf('azure_activity_log:')) {
        propsAppId.name = 'AzureMonitorActivityLogAppID';
        propsAppKey.name = 'AzureMonitorActivityLogAppKey';
    } else {
        propsAppId.name = 'AzureMonitorDiagnosticLogsAppID';
        propsAppKey.name = 'AzureMonitorDiagnosticLogsAppKey';
    }
    propsAppId.password = singleInput.SPNApplicationId;
    propsAppKey.password = singleInput.SPNApplicationKey;

    if (singleInput.SPNApplicationId === secretMask) {

        async.parallel([
            function (callback) {

                storagePasswords.fetch(function (err, storagePasswords) {
                    if (err) {
                        callback(err);
                    } else {
                        var pw = storagePasswords.item(':' + propsAppId.name + ':');
                        if (_.isUndefined(pw) || _.isNull(pw)) {
                            callback({ status: 404 });
                        } else {
                            Logger.debug(name, String.format('password object: {0}', JSON.stringify(pw)));
                            callback(null, pw._properties.clear_password);
                        }
                    }
                });

            },
            function (callback) {

                storagePasswords.fetch(function (err, storagePasswords) {
                    if (err) {
                        callback(err);
                    } else {
                        var pw = storagePasswords.item(':' + propsAppKey.name + ':');
                        if (_.isUndefined(pw) || _.isNull(pw)) {
                            callback({ status: 404 });
                        } else {
                            Logger.debug(name, String.format('password object: {0}', JSON.stringify(pw)));
                            callback(null, pw._properties.clear_password);
                        }
                    }
                });

            }

        ],
            function (err, result) {

                if (err) {
                    Logger.error(name, String.format('Error retrieving passwords: {0}', JSON.stringify(err)));
                    done (err);
                } else {

                    mySingleInput.SPNApplicationId = result[0];
                    mySingleInput.SPNApplicationKey = result[1];

                    done(null, mySingleInput);
                }

            });

    } else {

        //store both the appid and the appkey as passwords in StoragePasswords
        async.parallel([
            function (callback) {
                createOrUpdateStoragePassword(name, storagePasswords, propsAppId, function (err, result) {
                    callback(err, result);
                });
            },
            function (callback) {
                createOrUpdateStoragePassword(name, storagePasswords, propsAppKey, function (err, result) {
                    callback(err, result);
                });
            }
        ],
            function (err, result) {

                if (err) {
                    Logger.error(name, String.format('Error creating storage passwords: {0}', JSON.stringify(err)));
                    done (err);
                } else {
                    maskAppIdAndKeySync(name, session_key, singleInput);

                    done (null, singleInput);
                }

            });

    }
};

function maskAppIdAndKeySync (name, session_key, singleInput) {

    try {
        process.chdir(__dirname);

        var args = [];
        args.push('cmd', 'python', 'mask_secret.py');
        args.push('-n', name);
        args.push('-k', session_key);
        args.push('-p1', singleInput.SPNTenantID);
        args.push('-p2', secretMask);
        args.push('-p3', secretMask);
        args.push('-p4', singleInput.eventHubNamespace);
        args.push('-p5', singleInput.vaultName);
        args.push('-p6', singleInput.secretName);
        args.push('-p7', singleInput.secretVersion);

        var masker = spawnSync(process.env.SPLUNK_HOME + '\\bin\\splunk', args, { encoding: 'utf8' });
        Logger.debug(name, 'stdout: ' + masker.stdout);
        Logger.debug(name, 'stderr: ' + masker.stderr);
    }
    catch (err) {
        Logger.Error(name, String.format('Caught error in maskAppIdAndKeySync: {0}', JSON.stringify(err)));
    }
};

function createOrUpdateStoragePassword (name, storagePasswords, props, done) {

    async.waterfall([
        function (callback) {
            storagePasswords.fetch(function (err, storagePasswords) {
                if (err) {
                    callback(err);
                } else {
                    var pw = storagePasswords.item(':' + props.name + ':');
                    if (_.isUndefined(pw) || _.isNull(pw)) {
                        callback(null, false);
                    } else {
                        callback(null, true);
                    }
                }
            });
        },
        function (pwExists, callback) {
            if (pwExists) {
                storagePasswords.del(':' + props.name + ':', {}, function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        Logger.debug(name, 'password was deleted');
                        callback(null);
                    }
                });
            } else {
                Logger.debug(name, 'password does not exist');
                callback(null);
            }
        },
        function (callback) {
            Logger.debug(name, 'creating new password');
            storagePasswords.create(props, function (err, newPassword) {
                if (err) {
                    if (err.status === 409) {
                        callback(null, null);   // ignore duplicate already exists
                    } else {
                        callback(err);
                    }
                }
                else {
                    callback(null, newPassword);
                }
            });
        }

    ], function (err, result) {
        if (err) {
            Logger.error(name, String.format('Error {0} in the password waterfall: {1}', err.status, err.data.messages.text));
        } else {
            Logger.debug(name, String.format('New password was created'));
        }
        done(err, result);
    });
}


var messageHandler = function (name, data, eventWriter) {

    //var dataAsString = JSON.stringify(data);
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

    var sourceType = '';
    if (~name.indexOf('azure_activity_log:')) {
        sourceType = 'amal:activityLog';
    } else {
        sourceType = 'amdl:diagnosticLogs';

        var category = data.category.toUpperCase() || '';
        if (resourceType !== '') {
            var testSourceType = categories[resourceType + '/' + category];
            if (!_.isUndefined(testSourceType) && testSourceType.length > 0) {
                sourceType = testSourceType;
            }
        }
    }

    Logger.debug(name, String.format('Subscription ID: {0}, resourceType: {1}, resourceName: {2}, sourceType: {3}',
        subscriptionId, resourceType, resourceName, sourceType));

    var curEvent = new Event({
        stanza: name,
        sourcetype: sourceType,
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

exports.getScheme = function (schemeName, schemeDesc) {

    var scheme = new Scheme(schemeName);

    // scheme properties
    scheme.description = schemeDesc;
    scheme.useExternalValidation = true;  // if true, must define validateInput method
    scheme.useSingleInstance = false;      // if true, all instances of mod input passed to
    //   a single script instance; if false, user 
    //   can set the interval parameter under "more settings"

    // add arguments
    scheme.args = [
        new Argument({
            name: "SPNTenantID",
            dataType: Argument.dataTypeString,
            description: "Azure AD tenant containing the service principal.",
            requiredOnCreate: true,
            requiredOnEdit: false
        }),
        new Argument({
            name: "SPNApplicationId",
            dataType: Argument.dataTypeString,
            description: "Service principal application id (aka client id).",
            requiredOnCreate: true,
            requiredOnEdit: false
        }),
        new Argument({
            name: "SPNApplicationKey",
            dataType: Argument.dataTypeString,
            description: "Service principal password (aka client secret).",
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

exports.streamEvents = function (name, singleInput, eventWriter, done) {

    Logger.debug(name, 'Streaming events from Azure Event Hubs until silence for 5 seconds.');
    Logger.debug(name, String.format('single input = {0}', JSON.stringify(singleInput)));

    // setup
    var eventHubNamespace = singleInput.eventHubNamespace;
    var SPNName = singleInput.SPNApplicationId;
    var SPNPassword = singleInput.SPNApplicationKey;
    var SPNTenantID = singleInput.SPNTenantID;
    var vaultName = singleInput.vaultName;
    var secretName = singleInput.secretName;
    var secretVersion = singleInput.secretVersion;

    // get the list of all of the possible hubs for Azure Monitor
    var hubsToBeQueried = [];
    if (~name.indexOf('azure_activity_log:')) {
        hubsToBeQueried.push('insights-operational-logs');
    } else {
        var hubNames = Object.keys(allHubs);
        hubNames.forEach(function (hubName) {
            hubsToBeQueried.push(hubName);
        });
    }

    // object to hold client objects
    var amqpClients = {};

    var ehErrorHandler = function (hub, myIdx, rx_err) {
        Logger.debug(name, String.format('==> RX ERROR on hub: {0}, err: {1}', hub, rx_err));

        if (!_.isUndefined(amqpClients[hub])) {
            amqpClients[hub].client.disconnect();
            delete amqpClients[hub];
        }
    };

    var ehMessageHandler = function (hub, myIdx, msg) {

        var annotations = msg.messageAnnotations;
        var newOffsetData = annotations['x-opt-offset'];
        var newOffset = Number(newOffsetData);

        var err;
        subs.checkPointHubPartition(err, name, hub, myIdx, newOffset);

        Logger.debug(name, String.format('==> Message Received on hub: {0} and partition: {1}. newOffset = {2}', hub, myIdx, newOffset));

        if (!_.isUndefined(this._quiescenceTimer)) {
            var d = new Date();
            Logger.debug(name, String.format('Resetting the timer at: {0}', d.toISOString()));
            clearTimeout(this._quiescenceTimer);
            this._quiescenceTimer = setTimeout(disconnectFunction, 5000);
        }

        var records = msg.body.records;
        if (!_.isUndefined(records)) {

            Logger.debug(name, String.format('message with {2} records received from hub {0} and partition {1}', hub, myIdx, records.length));

            records.forEach(function (record) {
                messageHandler(name, record, eventWriter);
            });

        } else {
            Logger.debug(name, String.format('ehMessageHandler received a message from event hub {0} and partition {1} with no records.', hub, myIdx));
            Logger.debug(name, JSON.stringify(msg));
        }

    };

    var createPartitionReceiver = function (hub, curIdx, curRcvAddr, filterOption) {
        Logger.debug(name, String.format('createPartitionReceiver for hub: {0} and partition: {1}', hub, curIdx));
        return amqpClients[hub].client.createReceiver(curRcvAddr, filterOption)
            .then(function (receiver) {
                receiver.on('message', ehMessageHandler.bind(null, hub, curIdx));
                receiver.on('errorReceived', ehErrorHandler.bind(null, hub, curIdx));
            })
            .catch(function (e) {
                Logger.error(name, String.format('create receiver error: {0}', e));
            });
    };

    function range(begin, end) {
        return Array.apply(null, new Array(end - begin)).map(function (_, i) { return i + begin; });
    }

    var disconnectFunction = function () {

        Logger.debug(name, 'Five seconds of silence on all hubs, disconnecting.');
        var hubs = Object.keys(amqpClients);
        hubs.forEach(function (hub) {
            amqpClients[hub].client.disconnect();
            delete amqpClients[hub];
        });
        done();
    };

    var serviceBusHost = eventHubNamespace + '.servicebus.windows.net';
    subs.getEventHubCreds(SPNName, SPNPassword, SPNTenantID, vaultName, secretName, secretVersion)
        .then(function (creds) {

            var uri = 'amqps://' + encodeURIComponent(creds.sasKeyName) + ':' + encodeURIComponent(creds.sasKeyValue) + '@' + serviceBusHost;

            hubsToBeQueried.forEach(function (hub) {

                // make sure hub is initialized in checkpoints file
                var err;
                subs.checkPointHubPartition(err, name, hub);

                var filterOption = subs.getFilterOffsets(name, hub);
                var recvAddr = hub + '/ConsumerGroups/$default/Partitions/';

                amqpClients[hub] = {};
                amqpClients[hub].client = new AMQPClient(Policy.EventHub);

                amqpClients[hub].client.connect(uri)
                    .then(function () {
                        return Promise.all([
                            Promise.map(range(0, 4), function (idx) {
                                return createPartitionReceiver(hub, idx, recvAddr + idx, filterOption[idx]);
                            })
                        ]);
                    })
                    .catch(function (e) {
                        Logger.error(name, String.format('connection error: {0}', e));
                    });
            });
        })
        .then(function () {
            var d = new Date();
            Logger.debug(name, String.format('Time is now: {0}', d.toISOString()));
            this._quiescenceTimer = setTimeout(disconnectFunction, 5000);
        })
        .catch(function (err) {
            Logger.error(name, String.format('Error getting event hub creds: {0}', err));
            return done();
        });
};
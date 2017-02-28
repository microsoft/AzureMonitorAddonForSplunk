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

(function () {
    var splunkjs = require("splunk-sdk");
    var ModularInputs = splunkjs.ModularInputs;
    var Logger = ModularInputs.Logger;
    var Event = ModularInputs.Event;
    var Scheme = ModularInputs.Scheme;
    var Argument = ModularInputs.Argument;

    var rp = require('request-promise');
    var _ = require('underscore');
    var AMQPClient = require('amqp10').Client;
    var Policy = require('amqp10').Policy;
    var Promise = require('bluebird');
    var adal = require('adal-node');
    var path = require('path');

    var subs = require('./subs');
    var config = require('./config.json');

    var AZUREAPIVERSIONRESOURCES = '2016-09-01';
    var AZUREAPIVERSIONHUBS = '2015-08-01';

    subs.stringFormat();

    // getScheme method returns introspection scheme
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
                name: "subscriptionId",
                dataType: Argument.dataTypeString,
                description: "Subscription ID of the Azure resources that you want to monitor.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "resourceGroup",
                dataType: Argument.dataTypeString,
                description: "Name of the resource group containing the Azure resources that you want to monitor.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "tenantId",
                dataType: Argument.dataTypeString,
                description: "Tenant ID of Azure AD tenancy containing this subscription.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "clientId",
                dataType: Argument.dataTypeString,
                description: "Application ID (aka clientId) of Azure AD application representing this add-on.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "clientSecret",
                dataType: Argument.dataTypeString,
                description: "Key (aka password) of the Azure AD application.",
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
                name: "sasKeyName",
                dataType: Argument.dataTypeString,
                description: "Name of SAS authentication policy for event hub namespace.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "sasKeyValue",
                dataType: Argument.dataTypeString,
                description: "SAS key associated with SAS policy - gives access to event hub data.",
                requiredOnCreate: true,
                requiredOnEdit: false
            })
            // other arguments here
        ];

        return scheme;
    };

    // validateInput method validates the script's configuration (optional)
    exports.validateInput = function (definition, done) {
        done(); // doesn't seem to be called.
    };

    // streamEvents streams the events to Splunk Enterprise
    exports.streamEvents = function (name, singleInput, eventWriter, done) {

        Logger.debug(name, 'streamEvents called');

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

        var errorHandler = function () {
            Logger.error(name, 'got an event hubs error');
        };

        var checkpointFileLocation = path.join(process.env.SPLUNK_DB,'modinputs', 'azure_monitor_logs');

        exports.streamEventsFromEventHub(name, singleInput, messageHandler, errorHandler, checkpointFileLocation, function() {
            Logger.debug(name, 'Calling callback function from streamEvents.');
            done();
        });
    };

    exports.streamEventsFromEventHub = function streamEventsFromEventHub(name, singleInput, messageHandler, errorHandler, checkpointFileLocation, callback) {

        var tenantId = singleInput.tenantId;
        var subscriptionId = singleInput.subscriptionId;
        var clientId = singleInput.clientId;
        var clientSecret = singleInput.clientSecret;
        var resourceGroup = singleInput.resourceGroup;
        var eventHubNamespace = singleInput.eventHubNamespace;
        var sasKeyName = singleInput.sasKeyName;
        var sasKeyValue = singleInput.sasKeyValue;

        var authorityHostUrl = 'https://login.windows.net';
        var authorityUrl = authorityHostUrl + '/' + tenantId;
        var AuthenticationContext = adal.AuthenticationContext;
        var context = new AuthenticationContext(authorityUrl);
        var resource = 'https://management.core.windows.net/';
        var azureEnvironmentEndpoint = 'https://management.azure.com';
        var urlBaseResourceGroup = String.format(azureEnvironmentEndpoint + '/subscriptions/{0}/resourceGroups/{1}', subscriptionId, resourceGroup);
        var hubsActuallyInNamespace = [];
        var arrayOfLoggedResources = [];
        var bearerToken = '';
        var hubsPotentiallyQueried = [];
        var hubsToBeQueried = [];
        var amqpClients = {};
        var quiescenceTimer;

        var ehErrorHandler = function (myIdx, rx_err) { Logger.warn(name, '==> RX ERROR: ', rx_err); };

        var ehMessageHandler = function (hub, myIdx, msg) {

            var annotations = msg.messageAnnotations;
            var newOffsetData = annotations['x-opt-offset'];
            var newOffset = Number(newOffsetData);
            subs.checkPointHubPartition(checkpointFileLocation, hub, myIdx, newOffset);

            // each message resets the timer back to 5 seconds
            if (_.isUndefined(quiescenceTimer)) {
                Logger.debug(name, 'Resetting the timer.');
                clearTimeout(quiescenceTimer);
                quiescenceTimer = setTimeout(disconnectFunction, 1000);
            }

            Logger.debug(name, String.format('Message from hub: {0}, partition: {1}, at offset: {2}', hub, myIdx, newOffset));

            var records = msg.body.records;
            if (!_.isUndefined(records)) {

                Logger.debug(name, String.format('message with {2} records received from hub {0} and partition {1}', hub, myIdx, records.length));

                // get the name of the id property for this hub
                var nameOfIdPropertyForHub = config[hub] || '';

                Logger.debug(name, String.format('Name of property id for hub {0} is {1}.', hub, nameOfIdPropertyForHub));

                records.forEach(function (record) {

                    // in case of configuration error, index the record anyway
                    var indexTheRecord = true;

                    // assuming configuration is correct, see if the resource id of this record is in the list of those to be indexed
                    if (nameOfIdPropertyForHub.length > 0) {
                        var idPropertyValue = record[nameOfIdPropertyForHub] || "notFound";

                        Logger.debug(name, String.format('Checking that record id {0} is in the array of those to be indexed.', idPropertyValue));

                        if (_.indexOf(arrayOfLoggedResources, idPropertyValue, true) === -1) {

                            Logger.debug(name, String.format('Record id {0} is not in the list of those to be indexed.', idPropertyValue));

                            indexTheRecord = false;
                        }
                    } else {
                        Logger.error(name, String.format('Config file error, name of id property for hub {0} is missing.', hub));
                    }
                    if (indexTheRecord) {
                        messageHandler(record);
                    }
                });

            } else {
                Logger.debug(name, String.format('ehMessageHandler received a message from event hub {0} and partition {1} with no records.', hub, myIdx));
                Logger.debug(name, JSON.stringify(msg));
            }
        }

        var disconnectFunction = function () {

            Logger.debug(name, 'Disconnect function called after 1 second of silence from all hubs.');

            var hubs = Object.keys(amqpClients);
            hubs.forEach(function (hub) {
                amqpClients[hub].client.disconnect();
                delete amqpClients[hub];
            })

            callback();
        }


        function range(begin, end) {
            return Array.apply(null, new Array(end - begin)).map(function (_, i) { return i + begin; });
        }

        var createPartitionReceiver = function (hub, curIdx, curRcvAddr, filterOption) {
            return amqpClients[hub].client.createReceiver(curRcvAddr, filterOption)
                .then(function (receiver) {
                    receiver.on('message', ehMessageHandler.bind(null, hub, curIdx));
                    receiver.on('errorReceived', ehErrorHandler.bind(null, curIdx));
                });
        };

        var AuthenticationContext = adal.AuthenticationContext;
        var context = new AuthenticationContext(authorityUrl);
        subs.getToken(context, resource, clientId, clientSecret)

            .then(function (tokenResponse) {

                Logger.debug(name, 'Got bearer token.');
                bearerToken = tokenResponse.accessToken;

                var options = {
                    uri: urlBaseResourceGroup + '/providers/Microsoft.EventHub/namespaces/' + eventHubNamespace + '/eventhubs',
                    qs: {
                        'api-version': AZUREAPIVERSIONHUBS
                    },
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': "Bearer " + bearerToken
                    },
                    json: true
                }
                return rp(options);
            })

            .then(function (response) {

                Logger.debug(name, 'Queried for list of hubs.');

                // get the array of hubs that are in the event hub namespace
                var hubs = _.toArray(response.value);
                hubs.forEach(function (hub) {
                    hubsActuallyInNamespace.push(hub.name);
                });

                // set up and call to get the list of resources in the resource group
                var options = {
                    uri: urlBaseResourceGroup + '/resources',
                    qs: {
                        'api-version': AZUREAPIVERSIONRESOURCES
                    },
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': "Bearer " + bearerToken
                    },
                    json: true
                }
                return rp(options);
            })

            .then(function (response) {

                Logger.debug(name, 'Queried list of resources in rg.');

                var resources = _.toArray(response.value);
                resources.forEach(function (resource) {

                    var tags = resource.tags;
                    var getDiagnosticLogs = false;
                    var neededHubs = [];
                    var resourceToBeLogged = '';

                    if (_.isObject(tags)) {

                        var flag = tags.DiagnosticLogs;

                        if (!_.isUndefined(flag)) {

                            if (flag.toLowerCase() == 'true') {

                                // a resource type could have dropped logs into multiple hubs, so look up possible list in config file.
                                neededHubs = config[resource.type];

                                // grab the resource ID of the resource for later comparison
                                resourceToBeLogged = resource.id.toUpperCase();
                            }
                        };
                    }

                    if (resourceToBeLogged.length > 0) {
                        hubsPotentiallyQueried = _.union(hubsPotentiallyQueried, neededHubs);
                        arrayOfLoggedResources.push(resourceToBeLogged);
                    }
                });
                hubsToBeQueried = _.intersection(hubsPotentiallyQueried, hubsActuallyInNamespace);

                // sort so lookups are faster
                arrayOfLoggedResources.sort();

                Logger.debug(name, 'Setting up listeners for hubs.');

                // set up listeners on each hub
                var serviceBusHost = eventHubNamespace + '.servicebus.windows.net';
                var uri = 'amqps://' + encodeURIComponent(sasKeyName) + ':' + encodeURIComponent(sasKeyValue) + '@' + serviceBusHost;
                hubsToBeQueried.forEach(function (hub) {
                    subs.checkPointHubPartition(checkpointFileLocation, hub);

                    // create a client for the hub
                    amqpClients[hub] = {};
                    amqpClients[hub].client = new AMQPClient(Policy.EventHub);

                    var recvAddr = hub + '/ConsumerGroups/$default/Partitions/';

                    var filterOption = subs.getFilterOffsets(hub);

                    amqpClients[hub].client.connect(uri)
                        .then(function () {
                            return Promise.all([
                                Promise.map(range(0, 4), function (idx) {
                                    return createPartitionReceiver(hub, idx, recvAddr + idx, filterOption[idx]);
                                })
                            ]);
                        })
                        .error(function (e) {
                            Logger.warn(name, 'connection error: ', e);
                        });
                })
            })

            .then(function () {
                if (_.isUndefined(quiescenceTimer)) {
                    Logger.debug(name, 'Initializing the timer.');
                    quiescenceTImer = setTimeout(disconnectFunction, 1000);
                }
            })

            .catch(function (err) {
                Logger.error(name, 'Caught an error setting up hub listeners.');
                callback(err, null);
            });
    };

    ModularInputs.execute(exports, module);
})();

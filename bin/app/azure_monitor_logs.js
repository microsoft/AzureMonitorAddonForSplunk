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

var splunkjs = require("splunk-sdk");
var ModularInputs = splunkjs.ModularInputs;
var Logger = ModularInputs.Logger;
var request = require('request');
var rp = require('request-promise');

var _ = require('underscore');
var AMQPClient = require('amqp10').Client;
var Policy = require('amqp10').Policy;
var Promise = require('bluebird');
var path = require('path');

var subs = require('./subs');
var strings = require('./strings');
strings.stringFormat();
var allHubs = require('./hubs.json');

exports.streamEvents = function (name, singleInput, messageHandler, done) {

    Logger.info(name, 'Streaming events from Azure Event Hubs until silence for 5 seconds.');

    // setup
    var eventHubNamespace = singleInput.eventHubNamespace;
    var SPNName = singleInput.SPNName;
    var SPNPassword = singleInput.SPNPassword;
    var SPNTenantID = singleInput.SPNTenantID;
    var vaultName = singleInput.vaultName;
    var secretName = singleInput.secretName;
    var secretVersion = singleInput.secretVersion;

    // get the list of all of the possible hubs for Azure Monitor
    var hubsToBeQueried = [];
    var hubNames = Object.keys(allHubs);
    hubNames.forEach(function (hubName) {
        hubsToBeQueried.push(hubName);
    });

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
        subs.checkPointHubPartition(err, hub, myIdx, newOffset);

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
                messageHandler(record);
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

        Logger.info(name, 'Five seconds of silence on all hubs, disconnecting.');
        var hubs = Object.keys(amqpClients);
        hubs.forEach(function (hub) {
            amqpClients[hub].client.disconnect();
            delete amqpClients[hub];
        })
        done();
    }

    var serviceBusHost = eventHubNamespace + '.servicebus.windows.net';
    subs.getEventHubCreds(SPNName, SPNPassword, SPNTenantID, vaultName, secretName, secretVersion)
        .then(function (creds) {

            var uri = 'amqps://' + encodeURIComponent(creds.sasKeyName) + ':' + encodeURIComponent(creds.sasKeyValue) + '@' + serviceBusHost;

            hubsToBeQueried.forEach(function (hub) {

                // make sure hub is initialized in checkpoints file
                var err;
                subs.checkPointHubPartition(err, hub);

                var filterOption = subs.getFilterOffsets(hub);
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

}
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
var splunkjs = require("splunk-sdk");
var ModularInputs = splunkjs.ModularInputs;
var Logger = ModularInputs.Logger;

var Promise = require('bluebird');
var rp = require('request-promise');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var adal = require('adal-node');
var translator = require('amqp10').translator;
var strings = require('./strings');
strings.stringFormat();
var checkpoints = require('./checkpoints');

var AZUREAPIVERSIONKV = '2016-10-01';

exports.getEventHubCreds = function (SPNName, SPNPassword, SPNTenantID, vaultName, secretName, secretVersion) {
    var authorityUrl = 'https://login.windows.net/' + SPNTenantID;
    var AuthenticationContext = adal.AuthenticationContext;
    var context = new AuthenticationContext(authorityUrl);
    var resource = 'https://vault.azure.net';

    return new Promise(function (resolve, reject) {
        exports.getToken(context, resource, SPNName, SPNPassword)
            .then(function (tokenResponse) {

                bearerToken = tokenResponse.accessToken;

                var kvUri = String.format('https://{0}.vault.azure.net/secrets/{1}/{2}', vaultName, secretName, secretVersion);

                var options = {
                    uri: kvUri,
                    qs: {
                        'api-version': AZUREAPIVERSIONKV
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
                var creds = { sasKeyName: response.contentType, sasKeyValue: response.value };
                return resolve(creds);
            })
            .catch(function (err) {
                return reject(err);
            });
    })
}


exports.getToken = function (context, resource, clientId, clientSecret) {
    return new Promise(function (resolve, reject) {
        context.acquireTokenWithClientCredentials(resource, clientId, clientSecret, function (err, tokenResponse) {
            if (err) {
                return reject(err);
            }
            return resolve(tokenResponse);
        })
    })
}

exports.checkPointHubPartition = function (err, name, hub, idx, offset) {

    checkpointsArray = checkpoints.getCheckpoints(name);

    var hubOffsets = checkpointsArray[hub];
    if (_.isUndefined(hubOffsets)) {
        hubOffsets = [-1, -1, -1, -1];
    }

    if (!_.isUndefined(idx) && !_.isUndefined(offset)) {
        hubOffsets[idx] = offset;
    }

    checkpointsArray[hub] = hubOffsets;

    var err;
    checkpoints.putCheckpoints(err, name, checkpointsArray);
    return;
}

exports.getFilterOffsets = function (name, hubName) {

    checkpointsArray = checkpoints.getCheckpoints(name)
    var filterOffsets = checkpointsArray[hubName];

    var filterOption = [0, 0, 0, 0]; // todo:: need a x-opt-offset per partition.
    if (filterOffsets) {
        for (var i = 0; i < filterOffsets.length; i++) {
            filterOption[i] = {
                attach: {
                    source: {
                        filter: {
                            'apache.org:selector-filter:string': translator(
                                ['described', ['symbol', 'apache.org:selector-filter:string'], ['string', "amqp.annotation.x-opt-offset > '" + filterOffsets[i] + "'"]])
                        }
                    }
                }
            };
        }
    }

    return filterOption;
}
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
    var ModularInput = ModularInputs.ModularInput;
    var Logger = ModularInputs.Logger;
    var logs = require('./azure_monitor_logs');
    var strings = require('./strings');
    strings.stringFormat();
    var _ = require('underscore');
    var async = require('async');
    var spawnSync = require("child_process").spawnSync;

    var secretMask = '********';

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
                    } else {

                        mySingleInput.SPNApplicationId = result[0];
                        mySingleInput.SPNApplicationKey = result[1];

                        logs.streamEvents(name, mySingleInput, eventWriter, function () {
                            done();
                        });
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
                    } else {
                        maskAppIdAndKeySync(name, session_key, singleInput);

                        logs.streamEvents(name, singleInput, eventWriter, function () {
                            done();
                        });
                    }

                });

        }

    };

    function maskAppIdAndKeySync(name, session_key, singleInput) {

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

    function createOrUpdateStoragePassword(name, storagePasswords, props, done) {

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

    ModularInputs.execute(exports, module);
})();
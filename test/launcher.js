
process.env.SPLUNK_DB = 'c:/github/SplunkAddonForAzureMonitorLogs';

var splunkjs = require("splunk-sdk");
var ModularInputs = splunkjs.ModularInputs;
var Logger = ModularInputs.Logger;

var _ = require('underscore');
var logs = require('./azure_monitor_logs.js');
var subs = require('./subs');
var strings = require('./strings');
strings.stringFormat();

singleInput = require('./singleInput.json');


var messageHandler = function (data) {
    var dataAsString = JSON.stringify(data);

    if (dataAsString.length > 10000) {
        Logger.info(name, String.format('Got big data to index, length = {0}', dataAsString.length));
        Logger.info(name, dataAsString);
    }
}

var done = function () {
    console.info('done');
    process.exit();
}

var name = 'azure_monitor_logs';
logs.streamEvents(name, singleInput, messageHandler, function () {
    done();
});

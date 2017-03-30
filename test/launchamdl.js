
process.env.SPLUNK_DB = 'c:/github/SplunkAddonForAzureMonitorLogs';

var splunkjs = require("splunk-sdk");
var ModularInputs = splunkjs.ModularInputs;
var Logger = ModularInputs.Logger;

var _ = require('underscore');
var logs = require('./amdl');
var subs = require('./subs');
var strings = require('./strings');
strings.stringFormat();

singleInput = require('./singleInput.json');

var name = 'azure_diagnostic_logs://GOLIVE-Azure';

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

logs.streamEvents(name, singleInput, messageHandler, function () {
    done();
});

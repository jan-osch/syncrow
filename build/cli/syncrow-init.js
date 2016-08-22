var inquirer = require("inquirer");
var authorisation_helper_1 = require("../connection/authorisation_helper");
var fs = require("fs");
var program_1 = require("./program");
var noActionText = "No Action - existing files will be ignored, only new changes will be synced";
var pullActionText = "Pull - when other party connects all files will be overwritten by those remote";
var pushActionText = 'Push - when other party connects all remote files will be overwritten by those local';
var questions = [
    {
        type: 'confirm',
        name: 'listen',
        message: 'Do you want to listen for connections?',
        default: false
    },
    {
        type: 'input',
        name: 'remoteHost',
        message: 'Connection: remote host',
        when: function (answers) { return !answers.listen; },
        default: '0.0.0.0'
    },
    {
        type: 'input',
        name: 'remotePort',
        message: 'Connection: remote port',
        validate: function (value) {
            var valid = !isNaN(parseInt(value, 10));
            return valid || 'Please enter a number';
        },
        filter: Number,
        default: 2510,
        when: function (answers) { return !answers.listen; }
    },
    {
        type: 'input',
        name: 'localPort',
        message: 'On which local port would you like to listen',
        validate: function (value) {
            var valid = !isNaN(parseInt(value, 10));
            return valid || 'Please enter a number';
        },
        filter: Number,
        default: 2510,
        when: function (answers) { return answers.listen; }
    },
    {
        type: 'input',
        name: 'externalHost',
        message: 'What is your external IP/hostname?',
        when: function (answers) { return answers.listen; }
    },
    {
        type: 'list',
        name: 'rawStrategy',
        message: 'What synchronization strategy for every new connection would you like to choose?',
        choices: [
            noActionText,
            pullActionText,
            pushActionText
        ],
        default: 0
    },
    {
        type: 'confirm',
        name: 'deleteRemote',
        message: 'Would you like to delete remote files on push?',
        default: false,
        when: function (answers) { return answers.rawStrategy === pushActionText; }
    },
    {
        type: 'confirm',
        name: 'deleteLocal',
        message: 'Would you like to delete local files on pull?',
        default: false,
        when: function (answers) { return answers.rawStrategy === pullActionText; }
    },
    {
        type: 'input',
        name: 'rawFilter',
        message: 'Please enter comma-separated anymatch patterns for files that should be ignored',
        default: ''
    },
    {
        type: 'input',
        name: 'initialToken',
        message: 'Please enter token for obtaining connection (If you want to generate new token - leave blank)',
    },
    {
        type: 'confirm',
        name: 'generateToken',
        message: 'Would you like to generate a new token?',
        default: false,
        when: function (answers) { return !answers.initialToken; }
    },
    {
        type: 'confirm',
        name: 'authenticate',
        message: 'Would you like to authenticate transport sockets?',
        default: true
    },
    {
        type: 'confirm',
        name: 'watch',
        message: 'Would you like to watch local file system?',
        default: true
    },
    {
        type: 'confirm',
        name: 'reconnect',
        message: 'Would you like to reconnect when connection was lost?',
        default: false,
        when: function (answers) { return !answers.listen; }
    }
];
inquirer.prompt(questions).then(function (answers) {
    if (answers.generateToken) {
        var token = authorisation_helper_1.AuthorisationHelper.generateToken();
        console.log("Your new token will be: " + token);
        answers.initialToken = token;
        delete answers.generateToken;
    }
    if (answers.reconnect) {
        answers.interval = 10000; //10 seconds
        answers.times = 18; // 18 * 10s = 180s = 3 minutes
        delete answers.reconnect;
    }
    if (answers.rawStrategy === pullActionText) {
        answers.rawStrategy = 'pull';
    }
    if (answers.rawStrategy === pushActionText) {
        answers.rawStrategy = 'push';
    }
    if (answers.rawStrategy === noActionText) {
        answers.rawStrategy = 'no';
    }
    if (answers.externalHost === '') {
        delete answers.externalHost;
    }
    if (answers.rawFilter) {
        answers.rawFilter = answers.rawFilter.split(',');
    }
    fs.writeFileSync(program_1.configurationFileName, JSON.stringify(answers, null, 2));
});
//# sourceMappingURL=syncrow-init.js.map
import * as inquirer from "inquirer";
import * as fs from "fs";
import * as crypto from "crypto";
import {configurationFileName} from "./program";

const noActionText = `No Action - existing files will be ignored, only new changes will be synced`;
const pullActionText = `Pull - when other party connects all files will be overwritten by those remote`;
const pushActionText = 'Push - when other party connects all remote files will be overwritten by those local';

const questions = [
    {
        type: 'confirm',
        name: 'listen',
        message: 'Do you want to listen for connection?',
        default: true
    },

    {
        type: 'input',
        name: 'remoteHost',
        message: 'Connection: remote host',
        when: (answers)=>!answers.listen,
        default: '127.0.0.1'
    },

    {
        type: 'input',
        name: 'remotePort',
        message: 'Connection: remote port',
        validate: (value)=> {
            const valid = !isNaN(parseInt(value, 10));
            return valid || 'Please enter a number';
        },
        filter: Number,
        default: 2510,
        when: (answers)=>!answers.listen
    },

    {
        type: 'input',
        name: 'localPort',
        message: 'On which local port would you like to listen',
        validate: (value)=> {
            const valid = !isNaN(parseInt(value, 10));
            return valid || 'Please enter a number';
        },
        filter: Number,
        default: 2510,
        when: (answers)=>answers.listen
    },

    {
        type: 'input',
        name: 'externalHost',
        message: 'What is your external IP/hostname?',
        default: '127.0.0.1',
        when: (answers)=>answers.listen
    },

    {
        type: 'input',
        name: 'rawFilter',
        message: 'Please enter comma-separated gitignore like patterns for files that should be ignored',
        default: ''
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
        type: 'input',
        name: 'initialToken',
        message: 'Please enter password for obtaining connection',
    },

    {
        type: 'confirm',
        name: 'advanced',
        message: 'Would you like to setup advanced options?',
        default: false,
    },

    /**
     * Advanced:
     */

    {
        type: 'confirm',
        name: 'deleteRemote',
        message: 'Would you like to delete remote files on push?',
        default: true,
        when: (answers)=>answers.advanced && answers.rawStrategy === pushActionText
    },

    {
        type: 'confirm',
        name: 'deleteLocal',
        message: 'Would you like to delete local files on pull?',
        default: true,
        when: (answers)=>answers.advanced && answers.rawStrategy === pullActionText
    },

    {
        type: 'confirm',
        name: 'authenticate',
        message: 'Would you like to authenticate transport sockets?',
        default: true,
        when: (answers)=>answers.advanced
    },

    {
        type: 'confirm',
        name: 'watch',
        message: 'Would you like to watch local file system?',
        default: true,
        when: (answers)=>answers.advanced
    },

    {
        type: 'confirm',
        name: 'reconnect',
        message: 'Would you like to reconnect when connection was lost?',
        default: true,
        when: (answers)=>answers.advanced && !answers.listen
    }
];

inquirer.prompt(questions).then(answers=> {
    const hash = crypto.createHash('sha256');
    hash.update(answers.initialToken);
    answers.initialToken = hash.digest().toString('hex');

    if (!answers.advanced) {
        answers.reconnct = true;
        answers.watch = true;
        answers.authenticate = true;

        if (answers.rawStrategy === pullActionText) {
            answers.deleteLocal = true;
        }

        if (answers.rawStrategy === pushActionText) {
            answers.deleteRemote = true;
        }

        answers.reconnect = true;
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

    answers.rawFilter = answers.rawFilter ? answers.rawFilter.split(',') : [];

    fs.writeFileSync(configurationFileName, JSON.stringify(answers, null, 2));
});


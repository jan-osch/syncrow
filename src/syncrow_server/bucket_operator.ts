/**
 * Created by Janusz on 01.06.2016.
 */

/// <reference path="../../typings/main.d.ts" />


import fs = require("fs");
import FileContainer = require("../file_container");
import net  = require('net');

import UserService = require('./user_service');

import async from "async";
import _= require('lodash');
import Messenger = require("../messenger");
import Client = require("../client");

import errorPrinter = require('../utils/error_printer');
import TransferActions = require("./transfer_actions");
import EventsHelper from "../helpers/events_helper";
const debug = require('debug')('bucketoperator');


class BucketOperator {
    private path:string;
    private host:string;
    private otherParties:Array<Messenger>;
    private container:FileContainer;
    private otherPartiesMessageListeners:Array<Function>;
    private transferJobsQueue:async.AsyncQueue;

    //TODO add configuration support
    constructor(host:string, path:string, transferConcurrency=10) {
        this.path = path;
        this.host = host;
        this.container = new FileContainer(path);
        this.otherParties = [];
        this.otherPartiesMessageListeners = [];
        this.transferJobsQueue = async.queue((job, callback)=>job(callback), )
    }

    /**
     * @param otherParty
     */
    public addOtherParty(otherParty:Messenger) {
        const messageListener = (message)=>this.handleEvent(otherParty, message);

        otherParty.once(Messenger.events.disconnected, ()=>this.removeOtherParty(otherParty));
        otherParty.on(Messenger.events.message, messageListener);

        this.otherParties.push(otherParty);
        this.otherPartiesMessageListeners.push(messageListener);
    }

    /**
     * Completely removes otherParty from operaor
     * @param otherParty
     */
    public removeOtherParty(otherParty:Messenger) {
        const index = this.otherParties.indexOf(otherParty);
        const messageListener = this.otherPartiesMessageListeners[index];

        otherParty.removeListener(Messenger.events.message, messageListener);

        this.otherParties.splice(index, 1);
        this.otherPartiesMessageListeners.splice(index, 1);
    }

    private handleEvent(otherParty:Messenger, message:string) {
        const event = EventsHelper.parseEvent(otherParty, message);

        if (event.type === FileContainer.events.created || event.type === FileContainer.events.changed) {
            const pullStamp = `pulling file: ${event.body}`;
            console.time(pullStamp);

            TransferActions.pullFileFromParty(otherParty, event.body, this.host, this.container, (err)=> {
                errorPrinter(err);
                console.timeEnd(pullStamp);

                this.broadcastEvent(event, otherParty);
            });
        }

        if (event.type === FileContainer.events.createdDirectory) {
            this.container.createDirectory(event.body);
            this.broadcastEvent(event, otherParty);
        }

        if (event.type === FileContainer.events.deleted) {
            this.container.deleteFile(event.body);
            this.broadcastEvent(event, otherParty);
        }

        if (event.type === Client.events.pullFile) {
            const pushStamp = `pushing file: ${event.body.file} to address: ${event.body.address}`;
            console.time(pushStamp);

            TransferActions.pushFileToAddress(event.body.file, event.body.address, this.container, (err)=> {
                errorPrinter(err);

                console.timeEnd(pushStamp);
            });
        }
    }

    private broadcastEvent(event:{type:string; body?:any}, excludeParty?:Messenger) {
        this.otherParties.forEach((otherParty)=> {
            if (excludeParty && excludeParty === otherParty) {
                return;
            }

            otherParty.writeMessage(JSON.stringify(event));
        })
    }
}

export = BucketOperator;

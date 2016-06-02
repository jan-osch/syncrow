/// <reference path="../../typings/main.d.ts" />

import FileContainer = require("../helpers/file_container");
import net  = require('net');
import async = require('async');
import EventsHelper from "../helpers/events_helper";
import _= require('lodash');
import Messenger = require("../helpers/messenger");
import Client = require("../client/client");
import errorPrinter = require('../utils/error_printer');
import TransferActions = require("../helpers/transfer_actions");

const debug = require('debug')('bucketoperator');

export default class BucketOperator {
    private path:string;
    private host:string;
    private otherParties:Array<Messenger>;
    private container:FileContainer;
    private otherPartiesMessageListeners:Array<Function>;
    private transferJobsQueue:async.AsyncQueue;

    //TODO add configuration support
    constructor(host:string, path:string, transferConcurrency = 10) {
        this.path = path;
        this.host = host;
        this.container = new FileContainer(path);
        this.otherParties = [];
        this.otherPartiesMessageListeners = [];
        this.transferJobsQueue = async.queue((job, callback)=>job(callback), transferConcurrency);
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
            //TODO possible bug here
            this.addPullJobToTransferQueue(otherParty, event.body);
        }

        if (event.type === FileContainer.events.createdDirectory) {
            this.container.createDirectory(event.body);
            this.broadcastEvent(event, otherParty);
        }

        if (event.type === FileContainer.events.deleted) {
            this.container.deleteFile(event.body);
            this.broadcastEvent(event, otherParty);
        }

        if (event.type === Client.events.connectAndUpload) {
            this.addPushJobToTransferQueue(event.body.name, event.body.address);
        }
    }

    private addPullJobToTransferQueue(otherParty:Messenger, fileName:string) {
        const pullJob = (pullingDoneCallback)=> {
            const pullStamp = `pulling file: ${fileName}`;
            console.time(pullStamp);

            TransferActions.listenAndDownloadFile(otherParty, fileName, this.host, this.container, (err)=> {
                errorPrinter(err);
                console.timeEnd(pullStamp);
                this.broadcastEvent(event, otherParty);

                pullingDoneCallback();
            })
        };

        this.transferJobsQueue.push(pullJob);
    }

    private addPushJobToTransferQueue(fileName:string, address:{port:number, host:string}) {
        const pushJob = (pushingDoneCallback)=> {
            const pushStamp = `pushing file: ${fileName} to address: ${address}`;
            console.time(pushStamp);

            TransferActions.connectAndUploadFile(fileName, address, this.container, (err)=> {
                errorPrinter(err);
                console.timeEnd(pushStamp);
                pushingDoneCallback();
            });
        };

        this.transferJobsQueue.push(pushJob);
    }

    private broadcastEvent(event:{type:string; body?:any}, excludeParty?:Messenger) {
        this.otherParties.forEach((otherParty)=> {
            if (excludeParty && excludeParty === otherParty) {
                return;
            }

            EventsHelper.writeEventToOtherParty(otherParty, event.type, event.body);
        })
    }
}
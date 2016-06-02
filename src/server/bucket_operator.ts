/// <reference path="../../typings/main.d.ts" />

import FileContainer = require("../helpers/file_container");
import net  = require('net');
import async = require('async');
import EventsHelper from "../helpers/events_helper";
import TransferQueue from "../helpers/transfer_queue";
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
    private transferJobsQueue:TransferQueue;

    //TODO add configuration support
    constructor(host:string, path:string, transferConcurrency = 10) {
        this.path = path;
        this.host = host;
        this.container = new FileContainer(path);
        this.otherParties = [];
        this.otherPartiesMessageListeners = [];
        this.transferJobsQueue = new TransferQueue(transferConcurrency);
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

        if (this.handleTransferEvent(otherParty, event)) {
            debug('Server handled transfer event');
            return;

        } else if (event.type === Client.events.directoryCreated) {
            this.container.createDirectory(event.body);
            this.broadcastEvent(event.type, event.body, otherParty);
            return;

        } else if (event.type === Client.events.fileDeleted) {
            this.container.deleteFile(event.body);
            this.broadcastEvent(event.type, event.body, otherParty);
            return;

        }else  if (event.type === Client.events.getFile) {
            EventsHelper.writeEventToOtherParty(otherParty, TransferActions.events.connectAndDownload, event.body);
            return;

        } else if (event.type === EventsHelper.events.error) {
            console.info(`received error message ${JSON.stringify(event.body)}`);
            return;
        }

        EventsHelper.writeEventToOtherParty(otherParty, EventsHelper.events.error, `unknown event type: ${event.type}`);
    }

    private handleTransferEvent(otherParty:Messenger, event:{type:string, body?:any}):boolean {
        if (event.type === TransferActions.events.connectAndDownload) {
            this.transferJobsQueue.addConnectAndDownloadJobToQueue(event.body.address, event.body.fileName,
                this.container, `Server - downloading: ${event.body.fileName}`, ()=> {
                    this.broadcastEvent(Client.events.fileChanged, event.body.fileName, otherParty);
                });
            return true;

        } else if (event.type === TransferActions.events.connectAndUpload) {
            this.transferJobsQueue.addConnectAndUploadJobToQueue(event.body.fieldName, event.body.address,
                this.container, `Server - uploading: ${event.body.fieldName}`);
            return true;

        } else if (event.type === TransferActions.events.listenAndDownload) {
            this.transferJobsQueue.addListenAndDownloadJobToQueue(otherParty, event.body.fileName, this.host,
                this.container, `Server - downloading: ${event.body.fileName}`, ()=> {
                    this.broadcastEvent(Client.events.fileChanged, event.body.fileName, otherParty);
                });
            return true;

        } else if (event.type === TransferActions.events.listenAndUpload) {
            this.transferJobsQueue.addListenAndUploadJobToQueue(event.body.fileName, otherParty, this.host,
                this.container, `Server - uploading: ${event.body.fileName}`);
            return true;

        }

        return false;
    }

    private broadcastEvent(eventType:string, body:any, excludeParty?:Messenger) {
        this.otherParties.forEach((otherParty)=> {
            if (excludeParty && excludeParty === otherParty) {
                return;
            }

            EventsHelper.writeEventToOtherParty(otherParty, eventType, body);
        })
    }
}
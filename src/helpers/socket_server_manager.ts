/// <reference path="../../typings/main.d.ts" />

import async = require("async");
import net = require('net');
import {Socket} from "net";

class SocketServerManager {
    private _maxSockets:number;
    private socketQueue:AsyncQueue<Function>;
    static instance:SocketServerManager;

    constructor(maxSockets:number) {
        this._maxSockets = maxSockets;
        this.socketQueue = async.queue(this.processNewSocketRequest, this._maxSockets)
    }

    private processNewSocketRequest(callerCallback:Function, callback:Function) {
        net.createServer((socket:Socket)=> {
            socket.once('close', callback());
            callerCallback(socket);
        });
    };

    public requestNewSocket(callback:(socket:Socket)=>any) {
        this.socketQueue.push(callback);
    }

    public static getInstance(size):SocketServerManager {
        if (!SocketServerManager.instance) {
            SocketServerManager.instance = new SocketServerManager(size);
        }
        return SocketServerManager.instance;
    }
}

export = SocketServerManager;
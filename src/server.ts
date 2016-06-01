// /// <reference path="../typings/main.d.ts" />
//
// import fs = require('fs');
// import net = require('net');
//
// import Messenger = require('./socket_messenger');
// import Client = require('./client');
//
// class Server extends Client {
//
//     clients:Array<Messenger>;
//     socketServer:net.Server;
//
//     constructor(directoryToWatch, mainPort) {
//         super(directoryToWatch);
//         this.clients = [];
//         this.socketServer = this.createSocketServer(mainPort);
//     }
//
//     emitFileChanged(fileName:string) {
//         this.clients.forEach((socket:Messenger)=> {
//             Client.writeEventToSocketMessenger(socket, Client.events.changed, fileName);
//         });
//     }
//
//     addNewClient(socket) {
//         console.info('new client connected');
//         var clientSocketMessenger = new Messenger(null, null, socket);
//         this.clients.push(clientSocketMessenger);
//         clientSocketMessenger.on(Messenger.messageEvent, (data) =>this.routeEvent(clientSocketMessenger, data))
//     }
//
//     createSocketServer(mainPort) {
//         return net.createServer((socket)=>this.addNewClient(socket)).listen(mainPort, ()=> {
//             console.log(`started listening on port ${mainPort}`);
//         })
//     }
// }
//
// export = Server;
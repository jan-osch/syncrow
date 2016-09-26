import * as assert from "assert";
import * as async from "async";
import * as net from "net";
import DynamicServer from "../../connection/dynamic_server";

describe('DynamicServer', function () {
    let clientSocket;
    let connector;
    let server;

    afterEach(()=> {
        if (connector)connector.shutdown();
        if (server)server.close();
        if (clientSocket)clientSocket.destroy();
    });

    it('can be instantiated, meets the interface', ()=> {
        connector = new DynamicServer({}, 'localhost');
        assert(connector.getNewSocket instanceof Function);
        assert(connector.shutdown instanceof Function);
    });

    describe('getNewSocket', function () {
        it('it will call the listenCallback with address that it is listening on, and then expect connection', (done)=> {
            const token = 'mockToken128391nsanjda';

            connector = new DynamicServer({constantToken: token, authTimeout: 100}, '127.0.0.1');

            return async.series([
                    (cb)=>connector.getNewSocket({
                            listenCallback: (address)=> {

                                clientSocket = net.connect({
                                    host: address.remoteHost,
                                    port: address.remotePort
                                }, ()=> {
                                    clientSocket.write(token);
                                });

                            }
                        },
                        cb)
                ],
                done
            )
        });

        it('will fail for invalid token', (done)=> {
            const token = 'mockToken128391nsanjda';

            connector = new DynamicServer({constantToken: token, authTimeout: 100}, '127.0.0.1');

            return async.series([
                    (cb)=>connector.getNewSocket({
                            listenCallback: (address)=> {

                                clientSocket = net.connect({
                                    host: address.remoteHost,
                                    port: address.remotePort
                                }, ()=> {
                                    clientSocket.write('anotherToken');
                                });

                            }
                        },
                        cb)
                ],
                (err)=> {
                    assert(err, 'Should be an authorisation error');

                    return done();
                }
            )
        });
    });
});

import * as assert from "assert";
import * as async from "async";
import * as net from "net";
import ConstantServer from "../../connection/constant_server";


describe('ConstantServer', function () {
    const authTimeout = 100;
    const port = 4421;
    const token = 'mockToken128391nsanjda';

    let serverSocket;
    let clientSocket;
    let connector;
    let server;

    afterEach(()=> {
        if (serverSocket)serverSocket.destroy();
        if (connector)connector.shutdown();
        if (server)server.close();
        if (clientSocket)clientSocket.destroy();
    });

    it('can be instantiated, meets the interface', ()=> {
        connector = new ConstantServer(port, {constantToken: token, authTimeout: authTimeout});
        assert(connector.getNewSocket instanceof Function);
        assert(connector.shutdown instanceof Function);
    });

    describe('listen', ()=> {
        it('will start listening on given port', (done)=> {
            connector = new ConstantServer(port, {constantToken: token, authTimeout: authTimeout});
            connector.listen(done);
        })
    });

    describe('getSocket', ()=> {
        it('after calling listen it will listen on given port', (done)=> {
            connector = new ConstantServer(port, {constantToken: token, authTimeout: authTimeout});

            return async.series([
                    (cb)=>connector.listen(cb),

                    (cb)=> {
                        return async.parallel(
                            [
                                (parallelCallback)=>connector.getNewSocket({}, (err, socket)=> {
                                    serverSocket = socket;
                                    parallelCallback(err);
                                }),

                                (parallelCallback)=> {
                                    clientSocket = net.connect(port, ()=> {
                                        clientSocket.write(token);
                                        parallelCallback();
                                    })
                                }
                            ],
                            cb
                        )
                    }
                ],
                (err)=> {
                    assert(serverSocket, 'should have connected');
                    assert(clientSocket, 'should have connected from client');
                    done(err);
                }
            )
        })
        :
    });
});
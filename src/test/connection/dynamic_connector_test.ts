import * as assert from "assert";
import * as async from "async";
import * as net from "net";
import DynamicConnector from "../../connection/dynamic_connector";

describe('DynamicConnector', function () {
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
        connector = new DynamicConnector(10);
        assert(connector.getNewSocket instanceof Function);
        assert(connector.shutdown instanceof Function);
    });

    it('when getNewSocket is called it will connect to the remote address', (done)=> {
        const port = 4421;
        const token = 'mockToken128391nsanjda';

        connector = new DynamicConnector(10);

        server = net.createServer(s=> {
            serverSocket = s
        });

        return async.series([
                (cb)=>server.listen(port, cb),

                (cb)=>connector.getNewSocket({remoteHost: '127.0.0.1', remotePort: port, token: token}, cb)
            ],
            (err, result)=> {
                if (err) return done(err);

                clientSocket = result[1];
                assert(serverSocket, 'should have connected');

                serverSocket.on('data', (data)=> {
                    assert.equal(data, token, 'sent token should match');
                    done(err);
                });

            }
        )
    });
});
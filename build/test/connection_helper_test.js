var sinonChai = require("sinon-chai");
var chai = require("chai");
var net = require("net");
var connection_helper_1 = require("../connection/connection_helper");
chai.use(sinonChai);
var expect = chai.expect;
describe('ConnectionHelper', function () {
    it('can be instantiated, with minimal connection setup', function () {
        new connection_helper_1.ConnectionHelper({ remotePort: 10, remoteHost: '123' });
    });
    it('will throw error when it should listen and no port, or listen callback is specified', function () {
        expect(function () { return new connection_helper_1.ConnectionHelper({ listen: true }).to.throw; });
    });
    describe('getNewSocket', function () {
        it('if set to listen, it will setup a temporary server on specified port and pass socket to callback', function (done) {
            var helper;
            var connectToHelper = function () {
                var client = net.connect(3300, '0.0.0.0', function (err) {
                    if (err)
                        return done(err);
                    client.setEncoding('utf8');
                    client.on('data', function (data) {
                        expect(data).to.equal('expectedData');
                        client.end();
                        helper.shutdown();
                        return done();
                    });
                });
            };
            helper = new connection_helper_1.ConnectionHelper({
                listen: true,
                localHost: '0.0.0.0',
                localPort: 3300,
                listenCallback: connectToHelper
            });
            return helper.getNewSocket(function (err, socket) {
                if (err)
                    return done(err);
                return socket.write('expectedData');
            });
        });
        it('will connect with remote', function (done) {
            var helper = new connection_helper_1.ConnectionHelper({
                remoteHost: '0.0.0.0',
                remotePort: 3300,
            });
            var server = net.createServer(function (client) {
                client.setEncoding('utf8');
                client.on('data', function (data) {
                    expect(data).to.equal('randomText');
                    helper.shutdown();
                    server.close();
                    return done();
                });
            });
            server.listen(3300, function () {
                helper.getNewSocket(function (err, socket) {
                    if (err)
                        return (err);
                    return socket.write('randomText');
                });
            });
        });
    });
});
//# sourceMappingURL=connection_helper_test.js.map
"use strict";
const rewire = require('rewire');
const sinon = require('sinon');
const assert = require('chai').assert;
const expect = require('chai').expect;

let SocketServerManager = rewire('../../build/helpers/socket_server_manager');

describe('SocketServerManager', function () {
    it('can be instantiated', function () {
        let socketServerManager = new SocketServerManager(10);

        assert.isDefined(socketServerManager);
        assert.instanceOf(socketServerManager, SocketServerManager);
    });
    it('can be obtained via static method', function () {
        let socketServerManager = SocketServerManager.getInstance(10);

        assert.isDefined(socketServerManager);
        assert.instanceOf(socketServerManager, SocketServerManager);
    });
    describe('requestNewSocket', function () {
        let mockNet = {'createServer': function(){}};
        let socketServerManager;
        let mockSocket;
        const maxConnections = 1;

        before(function () {
            mockSocket = {
                once: function(){}
            };
            mockNet= {
                createServer: function(cb){
                    this.cb = cb(mockSocket);
                    return this;
                },
                listen: function(){
                    this.cb();
                }
            };
            SocketServerManager.__set__('net', mockNet);
        });

        beforeEach(function () {
            socketServerManager = new SocketServerManager(maxConnections);
        });

        it('if queue is empty it will immediately call callback with socket', function (done) {
            socketServerManager.requestNewSocket((socket)=> {
                expect(socket).to.equal(mockSocket);
                done();
            })
        });

        it('if queue is empty it will immediately call callback with socket', function (done) {
            socketServerManager.requestNewSocket((socket)=> {
                expect(socket).to.equal(mockSocket);
            })
        });
    });

});

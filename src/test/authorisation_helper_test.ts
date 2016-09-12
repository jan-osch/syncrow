import {expect} from "chai";
import {AuthorisationHelper} from "../connection/authorisation_helper";
import {obtainTwoSockets} from "../utils/fs_test_utils";
import * as assert from "assert";
import * as async from "async";


describe('AuthorisationHelper', ()=> {
    let result;
    let pairedShutDown;

    beforeEach((done)=> {
        pairedShutDown = obtainTwoSockets((err, twoSockets)=> {
            if (err)return done(err);

            result = twoSockets;
            return done();
        });
    });

    afterEach(()=> {
        pairedShutDown();
    });

    it('if both sides use the same token the authorisation will be positive', (done) => {
        const token = '92cu1is9810sajk';

        return async.parallel(
            [
                (cb)=>AuthorisationHelper.authorizeAsServer(result.server, token, {timeout: 100}, cb),
                (cb)=>AuthorisationHelper.authorizeAsClient(result.client, token, {timeout: 20}, cb)
            ],
            (err)=> {
                if (err)return done(err);

                assert.equal(result.server.listenerCount('data'), 0, 'all server "data" listeners have been removed');
                assert.equal(result.client.listenerCount('data'), 0, 'no client "data" listener have been created');

                return done();
            })
    });

    it('if token does not match - the result will be negative', (done) => {
        return async.parallel(
            [
                (cb)=>AuthorisationHelper.authorizeAsServer(result.server, 'AAA', {timeout: 100}, cb),

                (cb)=>AuthorisationHelper.authorizeAsClient(result.client, 'BBB', {timeout: 30}, cb)
            ],
            (err)=> {
                assert(err, 'authorization failed due to not matching token');

                assert.equal(result.server.listenerCount('data'), 0, 'all server "data" listeners have been removed');
                assert.equal(result.client.listenerCount('data'), 0, 'no client "data" listener have been created');

                return done();
            }
        );

    });

    it('if token is correct but timeout is exceeded on core side - result will be negative', function (done) {
        const token = 'SAME_TOKEN';

        return async.parallel(
            [
                (cb)=>AuthorisationHelper.authorizeAsServer(result.server, token, {timeout: 10}, cb),

                (cb)=> {
                    return setTimeout(
                        ()=>AuthorisationHelper.authorizeAsClient(result.client, token, {timeout: 30}, cb),
                        30
                    )
                }
            ],
            (err)=> {
                assert(err, 'authorization failed due to timeout');

                assert.equal(result.server.listenerCount('data'), 0, 'all server "data" listeners have been removed');
                assert.equal(result.client.listenerCount('data'), 0, 'no client "data" listener have been created');

                return done();
            }
        );
    });
});
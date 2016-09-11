import {expect} from "chai";
import {AuthorisationHelper} from "../connection/authorisation_helper";
import {obtainTwoSockets} from "../utils/fs_test_utils";
import * as assert from "assert";


describe('AuthorisationHelper', function () {

    it('if both sides use the same token the authorisation will be positive', function (done) {
        const finished = (err?)=> {
            pairedSocketsShutdown();
            return done(err);
        };

        const pairedSocketsShutdown = obtainTwoSockets((err, result)=> {
            if (err)return finished(err);

            const token = '92cu1is9810sajk';

            AuthorisationHelper.authorizeAsServer(result.server, token, {timeout: 100}, (err)=> {
                assert.equal(result.server.listenerCount('data'), 0, 'all server "data" listeners have been removed');
                assert.equal(result.client.listenerCount('data'), 0, 'no client "data" listener have been created');
                finished(err);
            });

            AuthorisationHelper.authorizeAsClient(result.client, token);
        })
    });

    it('if token does not match - the result will be negative', function (done) {
        const finished = (err?)=> {
            pairedSocketsShutdown();
            return done(err);
        };

        const pairedSocketsShutdown = obtainTwoSockets((err, result)=> {
            if (err)return finished(err);

            AuthorisationHelper.authorizeAsServer(result.server, 'AAA', {timeout: 100}, (err)=> {
                assert(err, 'authorization failed due to not matching token');
                assert.equal(result.server.listenerCount('data'), 0, 'all server "data" listeners have been removed');
                assert.equal(result.client.listenerCount('data'), 0, 'no client "data" listener have been created');
                finished();
            });

            AuthorisationHelper.authorizeAsClient(result.client, 'BBB');
        })
    });

    it('if token is correct but timeout is exceeded on core side - result will be negative', function (done) {
        const finished = (err?)=> {
            pairedSocketsShutdown();
            return done(err);
        };
        const token = 'someToken';

        const pairedSocketsShutdown = obtainTwoSockets((err, result)=> {
            if (err)return finished(err);

            AuthorisationHelper.authorizeAsServer(result.server, token, {timeout: 20}, (err)=> {
                assert(err, 'authorization failed due to timeout');
                assert.equal(result.server.listenerCount('data'), 0, 'all server "data" listeners have been removed');
                assert.equal(result.client.listenerCount('data'), 0, 'no client "data" listener have been created');
                finished();
            });
            setTimeout(()=> {
                AuthorisationHelper.authorizeAsClient(result.client, token);
            }, 30);
        })
    });
});
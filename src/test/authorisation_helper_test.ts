import * as chai from "chai";
import {AuthorisationHelper} from "../connection/authorisation_helper";
import {obtainTwoSockets} from "./test_utils";

const expect = chai.expect;

describe('AuthorisationHelper', function () {

    it('if both sides use the same token the authorisation will be positive', function (done) {
        const finished = (err?)=> {
            pairedSocketsShutdown();
            return done(err);
        };

        const pairedSocketsShutdown = obtainTwoSockets((err, result)=> {
            if (err)return finished(err);

            const token = '92cu1is9810sajk';

            let otherFinished = false;

            AuthorisationHelper.authorizeAsServer(result.server, token, {timeout: 100}, (err)=> {
                if (err)return finished(err);

                if (otherFinished)return finished();

                otherFinished = true;
            });

            AuthorisationHelper.authorizeAsClient(result.client, token, {timeout: 100}, (err)=> {
                if (err)return finished(err);

                if (otherFinished)return finished();

                otherFinished = true;
            });
        })
    });

    it('if token does not match - the result will be negative', function (done) {
        const finished = (err?)=> {
            pairedSocketsShutdown();
            return done(err);
        };

        const pairedSocketsShutdown = obtainTwoSockets((err, result)=> {
            if (err)return finished(err);

            let otherFinished = false;

            AuthorisationHelper.authorizeAsServer(result.server, 'AAA', {timeout: 100}, (err)=> {
                expect(err).to.be.defined;

                if (otherFinished)return finished();

                otherFinished = true;
            });

            AuthorisationHelper.authorizeAsClient(result.client, 'BBB', {timeout: 100}, (err)=> {
                expect(err).to.be.defined;

                if (otherFinished)return finished();

                otherFinished = true;
            });
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

            let otherFinished = false;

            AuthorisationHelper.authorizeAsServer(result.server, token, {timeout: 20}, (err)=> {
                expect(err).to.be.defined;

                if (otherFinished)return finished();

                otherFinished = true;
            });

            setTimeout(()=> {

                AuthorisationHelper.authorizeAsClient(result.client, token, {timeout: 100}, (err)=> {
                    expect(err).to.be.defined;

                    if (otherFinished)return finished();

                    otherFinished = true;
                });
            }, 30)
        })
    });
});
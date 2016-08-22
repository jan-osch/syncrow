var chai = require("chai");
var authorisation_helper_1 = require("../connection/authorisation_helper");
var test_utils_1 = require("./test_utils");
var expect = chai.expect;
describe('AuthorisationHelper', function () {
    it('if both sides use the same token the authorisation will be positive', function (done) {
        var finished = function (err) {
            pairedSocketsShutdown();
            return done(err);
        };
        var pairedSocketsShutdown = test_utils_1.obtainTwoSockets(function (err, result) {
            if (err)
                return finished(err);
            var token = '92cu1is9810sajk';
            var otherFinished = false;
            authorisation_helper_1.AuthorisationHelper.authorizeAsServer(result.server, token, { timeout: 100 }, function (err) {
                if (err)
                    return finished(err);
                if (otherFinished)
                    return finished();
                otherFinished = true;
            });
            authorisation_helper_1.AuthorisationHelper.authorizeAsClient(result.client, token, { timeout: 100 }, function (err) {
                if (err)
                    return finished(err);
                if (otherFinished)
                    return finished();
                otherFinished = true;
            });
        });
    });
    it('if token does not match - the result will be negative', function (done) {
        var finished = function (err) {
            pairedSocketsShutdown();
            return done(err);
        };
        var pairedSocketsShutdown = test_utils_1.obtainTwoSockets(function (err, result) {
            if (err)
                return finished(err);
            var otherFinished = false;
            authorisation_helper_1.AuthorisationHelper.authorizeAsServer(result.server, 'AAA', { timeout: 100 }, function (err) {
                expect(err).to.be.defined;
                if (otherFinished)
                    return finished();
                otherFinished = true;
            });
            authorisation_helper_1.AuthorisationHelper.authorizeAsClient(result.client, 'BBB', { timeout: 100 }, function (err) {
                expect(err).to.be.defined;
                if (otherFinished)
                    return finished();
                otherFinished = true;
            });
        });
    });
    it('if token is correct but timeout is exceeded on core side - result will be negative', function (done) {
        var finished = function (err) {
            pairedSocketsShutdown();
            return done(err);
        };
        var token = 'someToken';
        var pairedSocketsShutdown = test_utils_1.obtainTwoSockets(function (err, result) {
            if (err)
                return finished(err);
            var otherFinished = false;
            authorisation_helper_1.AuthorisationHelper.authorizeAsServer(result.server, token, { timeout: 20 }, function (err) {
                expect(err).to.be.defined;
                if (otherFinished)
                    return finished();
                otherFinished = true;
            });
            setTimeout(function () {
                authorisation_helper_1.AuthorisationHelper.authorizeAsClient(result.client, token, { timeout: 100 }, function (err) {
                    expect(err).to.be.defined;
                    if (otherFinished)
                        return finished();
                    otherFinished = true;
                });
            }, 30);
        });
    });
});
//# sourceMappingURL=authorisation_helper_test.js.map
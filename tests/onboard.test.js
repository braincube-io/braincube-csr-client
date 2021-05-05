// eslint-disable-next-line import/no-unresolved,no-unused-vars
const should = require('should');
const onboard = require('../lib/onboard.mjs');

describe('/lib/onboard', () => {

    it.skip('post board ok', (done) => {
        // test to be perform ;) fucking jest and mjs
        onboard.postBoard('braincubetransfer.test.mybraincube.com').then((server) => {
            done(server);
        });
    });
});

const onboard = require('../lib/onboard.mjs');
const should = require("should");

describe('/lib/onboard', () => {

    it.skip('post board ok', (done) => {
        //test to be perform ;) fucking jest and mjs
        onboard.postBoard('braincubetransfer.test.mybraincube.com').then((server) => {
            done(server);
        })
    });
});
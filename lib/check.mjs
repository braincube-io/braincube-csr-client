import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import readline from 'readline';
import util from 'util';

import { checkConnection } from './checkConn.mjs';

const WAIT_PUSH = 60000;


/**
 * Log a message into the stdout
 * @param str
 * @param newLine
 */
function log(str, newLine = true) {
    if (newLine) {
        process.stdout.write('\n');
    } else {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
    }
    process.stdout.write(str);
}

/**
 * Function to launch cli inquiring
 * @returns {Promise<void>}
 */
export async function cli() {
    inquirer
        .prompt([
            { // braincube transfer host. PROD or DEV
                type: 'list',
                name: 'server',
                message: 'SSO intance',
                choices: ['braincubetransfer', 'braincubetransfer.test'],
                default: 0,
                filter: (input) => `${input}.mybraincube.com`
            },
            {
                type: 'list',
                name: 'onboard',
                message: 'Onboard file',
                choices: () => {
                    return fs.readdirSync(path.resolve(process.cwd()))
                        .filter((p) => p.indexOf('.onboard') >= 0) // filter only onboard files
                        .map((p) => path.relative(process.cwd(), p));
                }
            }
        ])
        .then(async (answers) => {
            /* eslint-disable no-console */
            console.log(fs.readFileSync(path.resolve(process.cwd(), answers.onboard)).toString());
            const onboardInfo = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), answers.onboard)).toString());
            log(`Found onboard info ${util.inspect(onboardInfo)}`);
            const cert = forge.pki.certificateFromPem(fs.readFileSync(path.resolve(process.cwd(), onboardInfo.cert)));

            const key = forge.pki.privateKeyFromPem(fs.readFileSync(path.resolve(process.cwd(), onboardInfo.privateKey)));
            log(`Checking dataRepository ${onboardInfo.productId}`);
            try {
                await checkConnection(answers.server,
                    onboardInfo.productId,
                    forge.pki.certificateToPem(cert),
                    forge.pki.privateKeyToPem(key),
                    WAIT_PUSH);
            } catch (e) {
                /* eslint-disable no-console */
                console.error(e);
            }
        });
}

export default {};

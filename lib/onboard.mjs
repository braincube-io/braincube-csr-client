/* eslint-disable max-nested-callbacks */
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import https from 'https';
import url from 'url';
import opn from 'opn';
import readline from 'readline';

import { checkConnection } from './checkConn.mjs';

const onBoardingPath = '/sso-server/ws/transfer/board';

const WAIT_POLL = 600000; // 10 min
const WAIT_PUSH = 60000;

/**
 * Log a message into the stdout
 * @param str
 * @param newLine
 */
function log(str, newLine = true) {
    if (typeof str !== 'string') {
        process.stdout.write('\nError to display log ' + typeof str);
        return;
    }
    if (newLine) {
        process.stdout.write('\n');
    } else {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
    }
    process.stdout.write(str);
}

/**
 * Post the CSR to /sso-server/ws/transfer/sign?code=${code}
 * @param server braincubetransfer host
 * @param csr csr pem content
 * @param code request code
 * @return {Promise<any>}
 */
export async function postCsr({ server, csr, code }) {
    return new Promise((resolve, reject) => {
        // TEMPCode : envoyer csr dans le body en url
        // POST -> https://mybraincube.com
        const req = https.request({
            protocol: 'https:',
            host: server,
            path: `/sso-server/ws/transfer/sign?code=${code}`,
            method: 'POST'
        }, (res) => {
            let data = '';
            const { statusCode } = res;
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (statusCode === 200) {
                    resolve({ statusCode, data });
                } else {
                    reject(new Error(`Error while posting csr. Bad status code : ${statusCode}. ${data}`));
                }
            });
        });
        req.on('error', (err) => {
            reject(new Error(`An error occured during POST boarding information${err}`));
        });
        req.end(csr);
    });
}


/**
 * Make a GET call to the location, and resolve body and statusCode
 * @param location
 * @return {Promise<{ statusCode, body }>}
 */
async function pollOnce({ location }) {
    return new Promise((resolve, reject) => {
        let body = '';
        https.get(location, (res) => {
            const { statusCode } = res;
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                resolve({ statusCode, body });
            });
        }).on('error', (e) => {
            reject(new Error(`Error during polling ${location} : ${e}`));
        });
    });
}


/**
 * Poll the url using GET method waiting for HTTP 200 code
 * @param location url to poll
 * @param timeout global timeout
 * @return {Promise<{ statusCode, body }>}
 */
export async function poll({ location, timeout }) {
    // 206 -> en cours
    // 200-> ok
    let count = timeout;
    const sleepTime = 2000;
    const validReturnCode = 200;
    return new Promise((resolve, reject) => {
        let readTimeout;
        let rejTimeout;
        const repeat = async () => {
            const { statusCode, body } = await pollOnce({ location });
            log(`poll result was ${statusCode}. you have ${count / 1000} s`, false);
            if (statusCode !== validReturnCode) {
                readTimeout = setTimeout(repeat, sleepTime);
            } else {
                clearTimeout(rejTimeout);
                resolve({ statusCode, body });
            }
            count -= sleepTime;
        };

        repeat().catch((err) => {
            readTimeout = setTimeout(repeat, sleepTime);
            reject(err);
        });

        rejTimeout = setTimeout(() => {
            clearTimeout(readTimeout);
            reject(new Error(`Status code ${validReturnCode} not found in ${timeout} ms`));
        }, timeout);
    });
}

/**
 * Make a POST request to the boarding url, and resolve with the location (from headers) and the clientUrl (in reponse's body)
 * @param server hostname
 * @return {Promise<{ location, clientUrl }>}
 */
export async function postBoard({ server }) {
    log(`Onboarding to ${server}`);
    return new Promise((resolve, reject) => {
        let clientUrl = '';
        https.request({
            protocol: 'https:',
            host: server,
            path: onBoardingPath,
            method: 'POST'
        }, (resp) => {
            const location = resp.headers.location;
            resp.on('data', (chunk) => {
                clientUrl += chunk;
            });
            resp.on('end', () => {
                resolve({ location, clientUrl });
            });
        }).on('error', (err) => {
            reject(new Error(`An error occured during POST boarding information${err}`));
        }).end();
    });
}

/**
 * Genetate RSA key pair.
 * @param externalPrivKeyPath
 * @param [bits] the size for the private key in bits, defaults to 4096.
 * @return {Promise<keys>}
 */
export async function generateKeyPair(externalPrivKeyPath, bits = 4096) {

    if (externalPrivKeyPath) {
        log('Generating Key Pair using external RSA private key from : ' + externalPrivKeyPath);
        try {
            const privKey = fs.readFileSync(externalPrivKeyPath);
            const privateKey = forge.pki.privateKeyFromPem(privKey);
            const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
            const keys = {
                privateKey: privateKey,
                publicKey: publicKey
            };
            return Promise.resolve(keys);
        } catch (e) {
            throw new Error(
                'File can\'t be read or your private key format isn\'t good '
                + '(must be an RSA format with a recommended length of 4096 bits)'
            );
        }
    }

    const keys = forge.pki.rsa.generateKeyPair(bits);
    return Promise.resolve(keys);
}

/**
 * Save key pair into 2 files, and resolve once it's done
 * @param paths Object
 * @param paths.publicKey public key path
 * @param paths.privateKey private key path
 * @param keys Object
 * @param keys.publicKey
 * @param keys.privateKey
 * @return {Promise<>}
 */
export async function saveKeyPair(paths, keys) {
    return new Promise((resolve, reject) => {
        try {
            fs.writeFileSync(paths.publicKey, forge.ssh.publicKeyToOpenSSH(keys.publicKey));
            fs.writeFileSync(paths.privateKey, forge.pki.privateKeyToPem(keys.privateKey), { mode: 0o600 });
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Save certificate and resolves when it's done
 * @param paths Object
 * @param paths.cert cert path
 * @param cert cert in pem format
 * @return {Promise<any>}
 */
export async function saveCert(paths, cert) {
    return new Promise((resolve, reject) => {
        try {
            const forgeCert = forge.pki.certificateFromPem(cert);
            fs.writeFileSync(paths.cert, forge.pki.certificateToPem(forgeCert));
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}
async function saveOnboardFile(paths, onboardInfo) {
    return new Promise((resolve, reject) => {
        try {
            fs.writeFileSync(paths.onboard, JSON.stringify(onboardInfo));
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Save CSR into file and resolve when its done.
 * @param paths
 * @param paths.csr csr path
 * @param pemCsr csr in PEM format
 * @return {Promise<any>}
 */
export async function saveCsr(paths, pemCsr) {
    return new Promise((resolve, reject) => {
        try {
            fs.writeFileSync(paths.csr, pemCsr);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Generate CSR, and set user mail, productid and pulbic key.
 * @param userInfo
 * @param userInfo.user user mail
 * @param userInfo.productId wanted productId
 * @param keys
 * @param keys.publicKey public key
 * @return {Promise<csr>} forge.pki csr object
 */
export async function getCsr(userInfo, keys) {
    return new Promise((resolve, reject) => {
        try {
            const csr = forge.pki.createCertificationRequest();
            csr.publicKey = keys.publicKey;
            csr.setSubject([
                {
                    shortName: 'CN',
                    value: userInfo.user
                },
                {
                    name: 'UniqueIdentifier',
                    type: '2.5.4.45', // This is the OID for `UniqueIdentifier`,Cf http://www.alvestrand.no/objectid/2.5.4.45.html
                    value: userInfo.productId
                }
            ]);
            resolve(csr);
        } catch (e) {
            reject(e);
        }
    });
}


/**
 * Function to launch cli inquiring
 * @param externalPrivKeyPath
 * @returns {Promise<void>}
 */
export async function cli(externalPrivKeyPath) {
    /**
     * Prompt using inquirer
     */
    inquirer.prompt([
        { // braincube transfer host. PROD or DEV
            type: 'input',
            name: 'server',
            message: 'SSO instance (braincubetransfer.mybraincube.com)',
            default: 'braincubetransfer.mybraincube.com'
        },
        { // private key filename
            type: 'input',
            name: 'privKeyPath',
            message: 'Generated RSA private key file name (public key file name will be <private>.pub)',
            default: 'id_rsa'
        },
        { // should we send a trash file ?
            type: 'confirm',
            name: 'check',
            default: true,
            message: 'Check connection by sending .trash file (this will start the docker container) ?'
        },
        { // should we overwrite existing key/cert/pem ?
            type: 'confirm',
            name: 'overwrite',
            default: false,
            // eslint-disable-next-line max-len
            message: (answ) => `${answ.privKeyPath} or ${answ.privKeyPath}.pub  or ${answ.privKeyPath}.pem  or ${answ.privKeyPath}.csr already exists. Overwrite ?`,
            when: (answ) => {
                return fs.existsSync(path.resolve(process.cwd(), answ.privKeyPath))
                    || fs.existsSync(path.resolve(process.cwd(), `${answ.privKeyPath}.pub`))
                    || fs.existsSync(path.resolve(process.cwd(), `${answ.privKeyPath}.pem`))
                    || fs.existsSync(path.resolve(process.cwd(), `${answ.privKeyPath}.csr`))
                    || fs.existsSync(path.resolve(process.cwd(), `${answ.privKeyPath}.onboard`));
            }
        }
    ]).then(async (answers) => {
        if (answers.overwrite !== false) {
            // first generate CSR
            try {
                const paths = {
                    privateKey: path.resolve(process.cwd(), `${answers.privKeyPath}`),
                    publicKey: path.resolve(process.cwd(), `${answers.privKeyPath}.pub`),
                    csr: path.resolve(process.cwd(), `${answers.privKeyPath}.csr`),
                    cert: path.resolve(process.cwd(), `${answers.privKeyPath}.pem`),
                    onboard: path.resolve(process.cwd(), `${answers.privKeyPath}.onboard`),
                };

                // POST board
                log('Posting board request');

                let { location, clientUrl } = await postBoard({ server: answers.server });

                // overwrite domain to be the right sso instance
                clientUrl = clientUrl.replace(/(https:\/\/)([\da-z.-]*)/, 'https://' + answers.server);
                location = location.replace(/(https:\/\/)([\da-z.-]*)/, 'https://' + answers.server);

                // body url pour client
                log(`please visit ${clientUrl}`);
                opn(clientUrl);

                const tempCode = new url.URLSearchParams(url.parse(clientUrl).search).get('code');
                const timeout = WAIT_POLL;
                // location -> poll

                log('Polling onboarding result');
                // eslint-disable-next-line no-unused-vars
                const { statusCode, body } = await poll({ location, timeout });
                const userInfo = JSON.parse(body);

                // JSON is like :
                // {
                //     "user": "coucou4@test.mybraincube.com",
                //     "productId": "e3fd395e-2698-4c86-bee9-3c11b88c3341",
                //     "step": "BOARD_DETAILS_AVAILABLE",
                //     "owner": "adrien.deltour@ipleanware.com",
                //     "productName": "test-transfert4"
                // }

                log('Generating Key Pair');
                const keys = await generateKeyPair(externalPrivKeyPath);

                log('Saving Key Pair');
                await saveKeyPair(paths, keys);

                log('Generating Csr');
                const csr = await getCsr(userInfo, keys);

                log('Signing CSR');
                csr.sign(keys.privateKey);

                log('Verifing CSR');
                // eslint-disable-next-line no-unused-vars
                const verified = csr.verify();
                log('Saving CSR');
                const pemCsr = forge.pki.certificationRequestToPem(csr);
                await saveCsr(paths, pemCsr);

                // now post csr
                log('Posting CSR');
                const csrPost = await postCsr({ server: answers.server, csr: pemCsr, code: tempCode });
                log('CSR posted');
                log('saving certificate');
                await saveCert(paths, csrPost.data, keys);

                if (answers.check !== false) {
                    log('Check connection');
                    await checkConnection(answers.server,
                        userInfo.productId,
                        csrPost.data,
                        forge.pki.privateKeyToPem(keys.privateKey),
                        WAIT_PUSH);
                }

                await saveOnboardFile(paths, Object.assign({}, userInfo, paths));

                log(`Private key path is ${paths.privateKey}`);
                log(`Public key path is ${paths.publicKey}`);
                log(`CSR path is ${paths.csr}`);
                log(`Cert path is ${paths.cert}`);
                log(`Onboard file path is ${paths.onboard}`);

            } catch (e) {
                /* eslint-disable no-console */
                console.error(e);
            } finally {
                log('END');
            }
        }
    });
}

export default {};

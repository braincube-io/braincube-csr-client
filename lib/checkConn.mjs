import https from 'https';
import tls from 'tls';
import readline from 'readline';

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
 * POST a request using the given options
 * @param httpsOptions Object https options
 * @return {Promise<any>}
 */
async function postFile({ httpsOptions }) {
    return new Promise((resolve, reject) => {
        try {
            let body = '';
            https.request(httpsOptions,
                (resp) => {
                    const { statusCode } = resp;
                    resp.on('data', (chunk) => {
                        body += chunk;
                    });
                    resp.on('end', () => {
                        resolve({ statusCode, body });
                    });
                }).on('error', (err) => {
                reject(new Error(`An error occured during POST boarding information${err}`));
            }).end(' ');
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Try to POST a trash file, and waits for 200 HTTP code
 * @param server braincubetransfer hostname
 * @param productId Data Repository productId
 * @param certPem certificate in PEM format
 * @param privKeyPem private key certificate
 * @param timeout global timeout
 * @return {Promise<{ statusCode }>}
 */
export async function checkConnection(server, productId, certPem, privKeyPem, timeout) {
    log(`Check connection on ${server} for ${productId}\n`);
    const tlsOptions = {
        cert: certPem,
        key: privKeyPem
    };
    const tlsContext = tls.createSecureContext(tlsOptions);
    const httpsOptions = {
        protocol: 'https:',
        host: server,
        path: `/upload/${productId}`,
        method: 'POST',
        headers: {
            'File-Name': 'test.trash',
            'content-length': '1'
        },
        secureContext: tlsContext
    };
    httpsOptions.agent = https.Agent(httpsOptions);
    const sleepTime = 2000;
    const validReturnCode = 200;
    let tryCount = 0;
    return new Promise((resolve, reject) => {
        let postTimeout;
        let rejTimeout;
        const repeat = async () => {
            let status;
            try {
                const { statusCode } = await postFile({ httpsOptions });
                status = statusCode;
            } catch (err) {
                status = 500;
            }
            log(`post file result was ${status} ${'.'.repeat(tryCount)}`, false);
            if (status !== validReturnCode) {
                postTimeout = setTimeout(repeat, sleepTime);
            } else {
                log('Connection SUCCESSFULL');
                clearTimeout(rejTimeout);
                resolve({ status });
            }
            tryCount++;
        };
        repeat();
        rejTimeout = setTimeout(() => {
            clearTimeout(postTimeout);
            reject(new Error(`Status code ${validReturnCode} not found in ${timeout} ms`));
        }, timeout);
    });
}

export default {};

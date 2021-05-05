
import program from 'commander';

import * as onboard from './onboard.mjs';
import * as check from './check.mjs';

const softwareVersion = '<@VERSION@>';

// Version command option
program
    .version(softwareVersion)
    .description('A CLI client for onboarding on Braincube servers and checking connection');

// Onboard command option
program
    .command('onboard')
    .description('Onboard to braincube')
    .alias('o')
    .action(() => onboard.cli(process.argv.slice(2)[1]));

// Check file uploading test
program
    .command('check')
    .description('Check connection to Braincube (need to be onboarded first)')
    .alias('c')
    .action(check.cli);

// Help command option (also default choice)
program
    .on('--help', () => {
        /* eslint-disable no-console */
        console.log('\n  Examples:');
        console.log('\nto onboard :');
        console.log('\t$ ./braincube-csr-client-linux o');
        console.log('\t$ ./braincube-csr-client-linux onboard');
        console.log('to onboard using your own RSA private key (4096 bits recommended):');
        console.log('\t$ ./braincube-csr-client-linux onboard <private_key_pem_path>');
        console.log('to check :');
        console.log('\t$ ./braincube-csr-client-linux c');
        console.log('\t$ ./braincube-csr-client-linux check');
        console.log('');
    });

// Parse the option args to inquirer
program
    .parse(process.argv);

// Check if there are no args go to help !
if (!process.argv.slice(2).length) {
    program.help();
}

import replace from 'rollup-plugin-replace';
import settings from './package.json';

export default {
    input: './lib/cli.mjs',
    output: [{
        file: './build-mjs/index.mjs',
        format: 'esm',
        banner: '#! /bin/sh\n' +
            '":" //# comment; exec /usr/bin/env node --experimental-modules --no-warnings --harmony "$0" "$@"'
    }, {
        file: './build-cjs/index.js',
        format: 'cjs'
    }],
    plugins: [
        replace({
            delimiters: ['<@', '@>'],
            VERSION: settings.version
        })
    ],
};

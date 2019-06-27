# Braincube CSR Client

This is the Braincube CSR client repository.

The goal of this repository is to provide a CLI client to perform CSR request and onboard client onto Data Repository.

This CLI client asks some questions to do the operations. No options are needed.

## Installation (for braincube usage only)
To install, just run :
`npm i -g @braincube/braincube-csr-client`

This will install this package as a global package, and now will be available as the command `braincube-csr-internal`.

## Installation (from github public repository)
Just install all dependencies by typing :
```
    npm install
```

## Build
For build the cjs and mjs code type the following command :
```
    npm run build
```
For building the binary for the supported os platforms type
```
    npm run build-bin
```

## Run

* From Braincube installation use
    ```
        braincube-csr-internal or npx braincube-csr-internal
    ```
    commands, to display help/usage.

* From scratch building (like public repository) go to `./.bin` and type the binary of your plateform choice like that :
    ```
        ./braincube-csr-client-linux
    ```

## Usage

###### Usage: braincube-csr-internal [options] [command]

  A CLI client for onboarding onto Data Repository, on check connection

  Options:

    -V, --version  output the version number
    -h, --help     output usage information

  Commands:

    onboard|o      Onboard onto a Data Repository
    check|c        Check connection to a Data Repository


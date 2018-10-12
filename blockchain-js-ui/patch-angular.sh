#!/bin/bash

# see https://stackoverflow.com/questions/51087330/angular-6-many-cant-resolve-errors-crypto-fs-http-https-net-path-stream
sed -i 's/node: false,/node: {crypto:true, stream:true, fs:"empty", tls:"empty", net: "empty"},/' node_modules/@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/browser.js

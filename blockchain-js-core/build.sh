#/bin/bash

set -e

echo "typescript compilation..."
./node_modules/.bin/tsc

echo "bundling (browserify)..."
./node_modules/.bin/browserify dist/blockchain-browser.js -o dist/bundle.js

echo "all done."
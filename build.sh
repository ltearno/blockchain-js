#/bin/bash

set -e

echo "building rencontres..."
cd rencontres
npm install
cd ..

echo "building core..."
cd blockchain-js-core
npm install
cd ..

echo "building UI..."
cd blockchain-js-ui
ng build -prod
cd ..

echo "all done"
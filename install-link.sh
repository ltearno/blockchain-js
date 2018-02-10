#/bin/bash

set -e

echo "linking npm projects"

cd rencontres
npm link
cd ..

cd blockchain-js-core
npm link
cd ..

cd blockchain-js-ui
npm link rencontres
npm link blockchain-js-core
cd ..

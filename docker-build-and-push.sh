#/bin/bash

set -e

echo "pushing UI..."
cd blockchain-js-ui
docker build . -t eu.gcr.io/blockchain-js/blockchain-js-ui:latest
gcloud docker -- push eu.gcr.io/blockchain-js/blockchain-js-ui:latest
cd ..

echo "pushing rencontres..."
cd rencontres
docker build . -t eu.gcr.io/blockchain-js/rencontres:latest
gcloud docker -- push eu.gcr.io/blockchain-js/rencontres:latest
cd ..

echo "all done"
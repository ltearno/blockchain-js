#/bin/bash

set -e

echo "pushing blockchain-core..."
cd blockchain-js-core
docker build . -t eu.gcr.io/blockchain-js/blockchain-js-core:latest
gcloud docker -- push eu.gcr.io/blockchain-js/blockchain-js-core:latest
cd ..

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

echo "building http-redirect..."
cd http-redirect
docker build . -t eu.gcr.io/blockchain-js/http-redirect:latest
gcloud docker -- push eu.gcr.io/blockchain-js/http-redirect:latest
cd ..

echo "all done"
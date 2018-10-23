#/bin/bash

set -e

UI_IMAGE_REF=$(gcloud container images list-tags --format='get(digest)' --filter=tags:latest eu.gcr.io/blockchain-js/blockchain-js-ui)

echo "ui : $UI_IMAGE_REF"

cat application.yaml | \
    sed "s|blockchain-js-ui:latest|blockchain-js-ui@${UI_IMAGE_REF}|g" | \
    kubectl apply -f -

watch kubectl get pods
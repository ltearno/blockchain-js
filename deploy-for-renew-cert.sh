#/bin/bash

set -e

cat application-certrenew.yaml | \
    kubectl apply -f -

watch kubectl get pods
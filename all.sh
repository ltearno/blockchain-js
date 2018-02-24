#/bin/bash

set -e

echo "building all..."
echo ""

./build.sh && ./docker-build-and-push.sh && ./update-deployment.sh
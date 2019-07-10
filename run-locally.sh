#/bin/bash

set -e

docker run --name blockchain-js-core -d --restart always -p 9091:9091 blockchain-js-core:latest
docker run --name blockchain-js-ui -d --restart always -p 8081:8080 blockchain-js-ui:latest

echo "all done"

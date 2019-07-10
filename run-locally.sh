#/bin/bash

set -e

docker stop blockchain-js-core
docker rm blockchain-js-core
docker run --name blockchain-js-core -d --restart always -p 9091:9091 blockchain-js-core:$(git rev-parse HEAD)

docker stop blockchain-js-ui
docker rm blockchain-js-ui
docker run --name blockchain-js-ui -d --restart always -p 8081:8080 blockchain-js-ui:$(git rev-parse HEAD)

echo "all done"

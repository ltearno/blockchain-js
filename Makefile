PROJECT := $(shell gcloud config get-value project)
IMAGE_NAME := "eu.gcr.io/${PROJECT}/blockchain-js/certbot:arnaud"

UI_IMAGE_REF = $(shell git rev-parse HEAD)
CORE_IMAGE_REF = $(shell git rev-parse HEAD)

all:

build-core:
	echo "building core..."
	cd blockchain-js-core && yarn build

build-ui:
	echo "building UI..."
	cd blockchain-js-ui && yarn build

push-core: build-core
	echo "pushing blockchain-core..."
	cd blockchain-js-core && docker build . -t eu.gcr.io/blockchain-js/blockchain-js-core:latest
	gcloud docker -- push eu.gcr.io/blockchain-js/blockchain-js-core:latest

push-ui:
	echo "pushing UI..."
	cd blockchain-js-ui && docker build . -t eu.gcr.io/blockchain-js/blockchain-js-ui:latest
	gcloud docker -- push eu.gcr.io/blockchain-js/blockchain-js-ui:latest

push-redirect:
	echo "building http-redirect..."
	cd http-redirect && docker build . -t eu.gcr.io/blockchain-js/http-redirect:latest
	gcloud docker -- push eu.gcr.io/blockchain-js/http-redirect:latest

update-deployment:
	echo "ui : ${UI_IMAGE_REF}"
	echo "core : ${CORE_IMAGE_REF}"
	cat application.yaml | \
		sed "s|blockchain-js-ui:latest|blockchain-js-ui@${UI_IMAGE_REF}|g" | \
		sed "s|blockchain-js-core:latest|blockchain-js-core@${CORE_IMAGE_REF}|g" | \
		kubectl apply -f -
	watch kubectl get pods
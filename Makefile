PROJECT := $(shell gcloud config get-value project)

UI_IMAGE_REF = $(shell git rev-parse HEAD)
CORE_IMAGE_REF = $(shell git rev-parse HEAD)

all: build-core build-ui push-core push-ui update-deployment
	echo "all done."

build-core:
	echo "building core..."
	cd blockchain-js-core && yarn build

build-ui:
	echo "building UI..."
	cd blockchain-js-ui && yarn build

run-ui:
	echo "Running UI..."
	cd blockchain-js-ui && ./node_modules/.bin/ng serve

push-core: build-core
	echo "pushing blockchain-core (${CORE_IMAGE_REF})..."
	cd blockchain-js-core && docker build . -t eu.gcr.io/${PROJECT}/blockchain-js-core:${CORE_IMAGE_REF}
	gcloud docker -- push eu.gcr.io/${PROJECT}/blockchain-js-core:${CORE_IMAGE_REF}

push-ui:
	echo "pushing UI (${UI_IMAGE_REF})..."
	cd blockchain-js-ui && docker build . -t eu.gcr.io/${PROJECT}/blockchain-js-ui:${UI_IMAGE_REF}
	gcloud docker -- push eu.gcr.io/${PROJECT}/blockchain-js-ui:${UI_IMAGE_REF}

update-deployment:
	echo "ui : ${UI_IMAGE_REF}"
	echo "core : ${CORE_IMAGE_REF}"
	cat application.yaml | \
		sed "s|/blockchain-js/blockchain-js-ui:latest|/${PROJECT}/blockchain-js-ui:${UI_IMAGE_REF}|g" | \
		sed "s|/blockchain-js/blockchain-js-core:latest|/${PROJECT}/blockchain-js-core:${CORE_IMAGE_REF}|g" | \
		kubectl apply -f -
	watch kubectl get pods

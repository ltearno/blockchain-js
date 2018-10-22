PROJECT := $(shell gcloud config get-value project)
IMAGE_NAME := "eu.gcr.io/${PROJECT}/blockchain-js/certbot:arnaud"

image:
	echo building ${IMAGE_NAME}
	docker build -t ${IMAGE_NAME} .

push-image: image
	gcloud docker -- push ${IMAGE_NAME}

run-image: push-image
	kubectl apply -f application-cert-renewal.yaml

test-image:
	docker run -it ${IMAGE_NAME}

# HOW TO RENEW A CERTIFICATE
#
# make run-image
# inside the container, run certbot certonly, answer questions
# then those commands to get cert and pub key
# k cp blockchain-js-ui-78fd875556-lk2vd:/etc/letsencrypt/archive/blockchain-js.com/fullchain1.pem .certs/
# k cp blockchain-js-ui-78fd875556-lk2vd:/etc/letsencrypt/archive/blockchain-js.com/privkey1.pem .certs/
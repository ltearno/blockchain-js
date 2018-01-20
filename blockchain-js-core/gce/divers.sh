# Création et démarrage de la VM
gcloud compute instances create my-app-instance --tags http-server --metadata-from-file startup-script=gce/startup-script.sh

# Visualisation des logs de la VM
gcloud compute instances get-serial-port-output my-app-instance

# Accéder à la VM en ssh
gcloud compute --project "blockchain-185216" ssh "my-app-instance"

# Création du firewall pour donner accès à la VM depuis internet
gcloud compute firewall-rules create default-allow-http-9091 \
    --allow tcp:9091 \
    --source-ranges 0.0.0.0/0 \
    --target-tags http-server \
    --description "Allow port 9091 access to http-server"

# detruire l'instance
gcloud compute instances delete "my-app-instance"

# détruire la règle du firewall
gcloud compute firewall-rules delete default-allow-http-9091



# création d'une template de VM
gcloud compute instance-templates create blockchain-node-template \
  --metadata-from-file startup-script=gce/startup-script.sh \
  --tags http-server

# instantiation du groupe de vm
gcloud compute instance-groups managed \
  create blockchain-node-group \
  --base-instance-name blockchain-node-group \
  --size 5 \
  --template blockchain-node-template
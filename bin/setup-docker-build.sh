#! /bin/sh

# ------------------------------------------------------------------------------
# Required parameters
# ------------------------------------------------------------------------------
ENV_ALIAS=$1
REGISTRY_URI=$2
IMAGE_NAME=$3
IMAGE_TAG=$4

echo "Preparing Docker image for environment: ${ENV_ALIAS}"

# ------------------------------------------------------------------------------
# Build and tag Docker image
# ------------------------------------------------------------------------------
echo "Building and tagging Docker image ($IMAGE_NAME)"
# docker build -t $IMAGE_NAME --build-arg DB_PASSWORD=${DB_PASSWORD} $(cat ./env/sbx/sbx.env | sed 's@^@--build-arg @g' | paste -s -d " ") . --no-cache
docker build -t $IMAGE_NAME . --no-cache
docker tag $IMAGE_NAME:$IMAGE_TAG $REGISTRY_URI/${IMAGE_NAME}:$IMAGE_TAG

# ------------------------------------------------------------------------------
# Pushing image to registry
# ------------------------------------------------------------------------------
echo "Pushing image to registry: $REGISTRY_URI/${IMAGE_NAME}"
docker push $REGISTRY_URI/${IMAGE_NAME}:$IMAGE_TAG

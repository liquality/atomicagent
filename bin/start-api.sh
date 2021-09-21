#! /bin/sh

echo "--------------------------------"
echo "ENV_ALIAS: ${ENV_ALIAS}"
echo "CONFIG_PATH: ${CONFIG_PATH}"
echo "--------------------------------"
echo ""

echo "Starting the Atomic Agent API..."

npm run api-service

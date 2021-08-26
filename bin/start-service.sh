#! /bin/sh

echo "--------------------------------"
echo "ENV_ALIAS: ${ENV_ALIAS}"
echo "--------------------------------"
echo ""

echo "Starting the Atomic Agent service..."

npm run api-service

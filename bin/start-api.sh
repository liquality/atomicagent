#! /bin/sh

echo "--------------------------------"
echo "ENV_ALIAS: ${ENV_ALIAS}"
echo "APP_PORT: ${APP_PORT}"
echo "MONGO_CONNECT_URI: ${MONGO_CONNECT_URI}"
echo "--------------------------------"
echo ""

echo "Starting Atomic Agent API..."

npm run api

#! /bin/sh

echo "--------------------------------"
echo "TEST_ME: ${TEST_ME}"
echo "ENV_ALIAS: ${ENV_ALIAS}"
echo "CONFIG_PATH: ${CONFIG_PATH}"
echo "--------------------------------"
echo ""

echo "Starting Atomic Agent API..."

npm run api

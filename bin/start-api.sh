#! /bin/sh

echo "--------------------------------"
echo "ENV_ALIAS: ${ENV_ALIAS}"
echo "--------------------------------"
echo ""

echo "Running migrator..."

npm run migrate
# npm run migrate-test

# echo "Starting Atomic Agent API..."

# npm run api
# npm run api-test

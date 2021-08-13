#! /bin/sh

echo "--------------------------------"
echo "ENV_ALIAS: ${ENV_ALIAS}"
echo "--------------------------------"
echo ""

echo "Running migrator..."

npm run migrate

# echo "Starting Atomic Agent API..."

# npm run api

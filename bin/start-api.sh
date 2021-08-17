#! /bin/sh

echo "--------------------------------"
echo "ENV_ALIAS: ${ENV_ALIAS}"
echo "--------------------------------"
echo ""

echo "Running migrator..."

export MIGRATE_KEEP_ALIVE=true
npm run migrate

# echo "Starting Atomic Agent API..."

# npm run api

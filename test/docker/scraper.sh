echo "Ξ Waiting for ethereum rpc http://${ETH_HOST}:${ETH_PORT}/..."
until $(curl --silent --request POST --output /dev/null --fail --header 'Content-Type: application/json' --data '{"jsonrpc":"2.0","method":"net_listening","params":[],"id": 1}' http://${ETH_HOST}:${ETH_PORT}/); do
  echo "Ξ..."
  sleep 1
done

ethereum-scraper

echo "₿ Waiting for bitcoin rpc http://${BTC_HOST}:${BTC_PORT}/..."
until $(curl --basic -u ${BTC_USER}:${BTC_PASS} --silent --request POST --output /dev/null --fail --header 'Content-Type: application/json' --data '{"method":"getblockcount"}' http://${BTC_HOST}:${BTC_PORT}/); do
  echo "₿..."
  sleep 1
done

echo "Ξ Waiting for ethereum rpc http://${ETH_HOST}:${ETH_PORT}/..."
until $(curl --silent --request POST --output /dev/null --fail --header 'Content-Type: application/json' --data '{"jsonrpc":"2.0","method":"net_listening","params":[],"id": 1}' http://${ETH_HOST}:${ETH_PORT}/); do
  echo "Ξ..."
  sleep 1
done

echo "Getting Ethereum coinbase address..."
COINBASE=$(curl --request POST \
  --silent \
  --url http://${ETH_HOST}:${ETH_PORT}/ \
  --header 'Content-Type: application/json' \
  --data "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_coinbase\",
    \"id\": 2
  }" | jq --raw-output '.result')
echo "Ξ Coinbase Address: ${COINBASE}"

echo "Ξ Sending 100 ETH to ${ETH_AGENT_ADDRESS} from ${COINBASE}..."
HASH=$(curl --request POST \
  --silent \
  --url http://${ETH_HOST}:${ETH_PORT}/ \
  --header 'Content-Type: application/json' \
  --data "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_sendTransaction\",
    \"params\": [{
      \"from\": \"${COINBASE}\",
      \"to\": \"${ETH_AGENT_ADDRESS}\",
      \"value\": \"0x56bc75e2d63100000\"
    }],
    \"id\": 300
  }" | jq --raw-output '.result')
echo "Ξ Tx Hash: ${HASH}"

echo "Ξ Sending 100 ETH to ${ETH_WALLET_ADDRESS} from ${COINBASE}..."
HASH=$(curl --request POST \
  --silent \
  --url http://${ETH_HOST}:${ETH_PORT}/ \
  --header 'Content-Type: application/json' \
  --data "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_sendTransaction\",
    \"params\": [{
      \"from\": \"${COINBASE}\",
      \"to\": \"${ETH_WALLET_ADDRESS}\",
      \"value\": \"0x56bc75e2d63100000\"
    }],
    \"id\": 300
  }" | jq --raw-output '.result')
echo "Ξ Tx Hash: ${HASH}"

mine_btc () {
  echo "₿ Generating $1 block(s) to $2..."
  HASH=$(curl --request POST \
    --basic -u ${BTC_USER}:${BTC_PASS} \
    --silent \
    --url http://${BTC_HOST}:${BTC_PORT}/ \
    --header 'Content-Type: application/json' \
    --data "{
      \"jsonrpc\": \"2.0\",
      \"id\": \"0\",
      \"method\": \"generatetoaddress\",
      \"params\": [$1, \"$2\"]
    }" | jq --raw-output '.result[0]')
  echo "₿ Tx Hash: ${HASH}"
}

mine_eth () {
  echo "Ξ Sending a tx..."
  HASH=$(curl --request POST \
    --silent \
    --url http://${ETH_HOST}:${ETH_PORT}/ \
    --header 'Content-Type: application/json' \
    --data "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_sendTransaction\",
    \"params\": [{
      \"from\": \"${COINBASE}\",
      \"to\": \"${ETH_AGENT_ADDRESS}\",
      \"value\": \"0x56bc75e2d63100000\"
    }],
    \"id\": 3
  }" | jq --raw-output '.result')
  echo "Ξ Tx Hash: ${HASH}"
}

mine_btc 100 $BTC_AGENT_ADDRESS
mine_btc 100 $BTC_WALLET_ADDRESS
mine_btc 100 bcrt1qegy3hk2p92a6yvt0x47jc6xw7u39vflgv8uxvm

while true; do
mine_btc 1 bcrt1qegy3hk2p92a6yvt0x47jc6xw7u39vflgv8uxvm
mine_eth
sleep 5
done

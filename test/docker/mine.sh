mine_btc () { curl --basic -u bitcoin:local321 -X POST -d "{\"jsonrpc\": \"2.0\", \"id\": \"0\", \"method\": \"generate\", \"params\": [$1]}" http://${BTC_HOST}:${BTC_PORT}; }
mine_eth () { curl -X POST -d '{"jsonrpc": "2.0", "method": "eth_sendTransaction", "params": [{"from":"0xec98c8F5724D286faEd52270538677D7959748D5","to":"0xec98c8F5724D286faEd52270538677D7959748D5","value":"0xfffff"}], "id": 1}' http://${ETH_HOST}:${ETH_PORT}; }

sleep 30
mine_btc 100

while true; do
mine_btc 1
mine_eth
sleep 5
done

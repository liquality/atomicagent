// Heroku isn't able to build usb package :/
// and we don't need it for the agent

console.log('Removing usb module from package-lock.json')

const lock = require('./package-lock.json')

delete lock.dependencies.usb
delete lock.dependencies['@ledgerhq/hw-transport-node-hid'].requires.usb

require('fs').writeFileSync('./package-lock.json', JSON.stringify(lock, null, 2), 'utf8')

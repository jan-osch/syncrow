import Client = require('./client');

const DIRECTORY = '/tmp/syncrow';

console.log(`client watching directory: ${DIRECTORY}`);
let client = new Client(DIRECTORY);

client.connect('', 1234);

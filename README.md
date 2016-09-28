# Syncrow

Real time file synchronization using sockets.

## Installation

`$ npm install -g syncrow`

## Configuration

You need to configure syncrow in directory that you want to synchronize.

`$ syncrow init`

This command will run an interactive setup, 
similar to `npm init`, it will ask questions and save your answers.

The result will be a `.syncrow.json` with your setup.

## Running

`$ syncrow run` or just `$ syncrow`

This command will look for `.syncrow.json` file in current directory, 
if the file exists it will start a *syncrow* process using it as configuration.  

## Connecting two machines

First install syncrow globally on both machines that you want to connect.
Setup one machine to listen for incoming connections:
*(Your password will be stored as a hash)*

```
user@server $ syncrow init
? Do you want to listen for connection? Yes
? On which local port would you like to listen 2510
? What is your external IP/hostname? 192.168.0.6
? Please enter comma-separated anymatch patterns for files that should be ignored .git,node_modules
? What synchronization strategy for every new connection would you like to choose? No Action - existing files will be ignored, only new changes will be synced
? Please enter password for obtaining connection my_horse_is_amazing
? Would you like to setup advanced options? No
```

Then configure *syncrow* on second machine that will connect:

```
user@laptop $ syncrow init
? Do you want to listen for connection? No
? Connection: remote host 192.168.0.6
? Connection: remote port 2510
? Please enter comma-separated anymatch patterns for files that should be ignored .git,.idea,node_modules
? What synchronization strategy for every new connection would you like to choose? Push - when other party connects all remote files will be overwritten by those local
? Please enter password for obtaining connection my_horse_is_amazing
? Would you like to setup advanced options? No
```

Once configured - start *syncrow* on both machines:

`user@server $ syncrow run`

and 

`user@laptop $ syncrow run`

After a connection is obtained - *syncrow* will sync existing files.
This will run both *syncrow* instances as a foreground processes.
It is possible to connect multiple connecting *syncrow* instances to single *syncrow* listener

## Using as a library
It is possible to use *syncrow* as a part of node program.

### Class: Server
Listens for incoming connections.

#### new Server(params)
```js
const syncrow = require('syncrow');

const server = new syncrow.Server({path: './path/to_watch', localPort: 2510, externalHost: '192.168.0.2'});
                                      
```
params:
* `path`  **String** path to watch
* `localPort` **Number** port to listen on
* `externalHost` **String** external domain/IP  
* `[initalToken]` **String** optional token that will be used for authentication
* `[watch]` **Boolean** optional, defaults to `true`, if set to `false` server will not watch local files

#### server.engine
An instance of `syncrow.Engine`
#### server.start(callback)
starts the server watching the FS and listening for connections.
#### server.shutdown()
Completely stops the server. 

### Class: Client
Connects to remote server.
#### new Client(params)
```js
const syncrow = require('syncrow');

const client = new syncrow.Client({path: './path/to_watch', remotePort: 2510, remoteHost: '127.0.0.1'});                                      
```
params:
* `path`  **String** path to watch
* `remotePort` **Number** port for connection
* `remoteHost` **String** host for connection
* `[initalToken]` **String** optional token that will be used for authentication
* `[watch]` **Boolean** optional, defaults to `true`, if set to `false` server will not watch local files
#### client.engine
An instance of `syncrow.Engine`
#### client.start(callback)
starts the watching the path and connects to remote server.
#### client.shutdown()
Disconnects and stops the client.

### Class: Engine
Watches local file system and handles messages from remote parties.
It should not be created directly.

```js
const server = new syncrow.Server({path: './path/to_watch', localPort: 2510, externalHost: '192.168.0.2'});

server.start((err)=>{
    if(err) return console.error(err);
    
    server.engine.on('newFile', (file)=>console.log(`remote created a new file: ${file}`));
    
    server.engine.on('changedFile', (file)=>console.log(`remote changed file: ${file}`));
    
    server.engine.on('deletedPath', (path)=>console.log(`remote deleted path (file or directory): ${path}`));
});
```

#### event: newFile
emitted when file changed by remote has been downloaded. Params:
* `filePath` **String**  
    
#### event: changedFile
emitted when file changed by remote has been downloaded. Params:
* `filePath` **String** path of the file that changed
   
#### event: deletedPath
emitted when path (file or directory) has been deleted locally. Params:
* `filePath` **String** path of the file/directory deleted

#### event: newDirectory
emitted when directory created by remote has been created locally. Params:
* `dirPath` **String** path of the directory created 

#### event: error
emitted on error. Params:
* `error` **Error**

#### event: synced
emitted when synchronization with remote has finished
 
## Roadmap

* Add interval synchronization
* Separate into several repositories
* Integrate with Atom

## Licence
MIT

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

```js
const syncrow = require('syncrow');

syncrow.listen('./path_to/watch', 2510, {externalHost: '192.168.0.6'}, (err, engine)=>{
    if(err) return console.error(err);
    
    engine.on('newFile', (file)=>console.log(`remote created a new file: ${file}`));
    
    engine.on('changedFile', (file)=>console.log(`remote changed file: ${file}`));
    
    engine.on('deletedPath', (path)=>console.log(`remote deleted path (file or directory): ${path}`));
   
    // etc.
});

```

Full list of events emitted by engine:
```js
const engineEvents = {
    /**
     * @event emitted when new file created by remote has been downloaded
     * @param {String} filePath
     */
    newFile: 'newFile',
    /**
     * @event emitted when file changed by remote has been downloaded
     * @param {String} filePath
     */
    changedFile: 'changedFile',
    /**
     * @event emitted when path (file or directory) has been deleted locally
     * @param {String} path
     */
    deletedPath: 'deletedPath',
    /**
     * @event emitted when directory created by remote has been created locally
     * @param {String] dirPath
     */
    newDirectory: 'newDirectory',

    /**
     * @event emitted on error
     * @param {Error} error
     */
    error: 'error',
    /**
     * @event emitted when synchronization with remote has finished
     */
    synced: 'synced',
    /**
     * @event emitted when engine is shutting down
     */
    shutdown: 'shutdown',
};
```
 


## Licence
MIT









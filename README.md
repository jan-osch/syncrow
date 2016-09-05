# Syncrow

Real time file watching synchronization with sockets.

## Installation

`$ npm install -g syncrow`


## Using as a command line tool

First install syncrow on both machines that you want to connect.

Then configure syncrow on machine that will be listening for connections

`user@machine1 $ syncrow init`

Then you need to start the application on the second machine.
In the following command you need to use the others machine IP
(here: example 169.0.0.2).

`user@machine2 $ syncrow --host 169.0.0.2`

Once both machines connected the applications will start syncrhonization.

## Indirect connection

If you want to connect more machines or two machines that do not have a public IP,
you can use `syncrow-server` command.

First you need to start syncrow server on a machine that is reachable from all the
machines that you want to connect (for example you can use a public cloud virtual machine with
public IP). One syncrow server can support multiple synchronization buckets
(each bucket is like a shared directory).

Create an empty directory for buckets and a sample bucket:

` root@server $ mkdir -p buckets/my_bucket`

Navigate to the buckets directory:

` root@server $ cd buckets`

Start the server (it will detect the `my_bucket` directory you created):

 `root@server $ syncrow-server`

Connect from `machine1` to the server. This command will connect directly to my_bucket

` user@machine1 $ syncrow --host 173.31.10.22 --bucket my_bucket`

Then just repeat the process on each machine you want to connect:

` user@machine2 $ syncrow --host 173.31.10.22 --bucket my_bucket`

## TODOS:

* remove express
* remove gulp
* make it as lightweight as possible
* add more tests









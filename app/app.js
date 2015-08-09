var WebSocketServer = require('websocket').server,
    http = require('http'),
    binpacking = require('binpacking'), //https://github.com/jsmarkus/node-bin-packing
    Chance = require('chance'),
    winston = require('winston');

/**
 * Adding transport file  in root dir for Winston
 */
winston.add(winston.transports.File, { filename: 'server.log' });

var port = 3002;

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(port, function() {
    console.log('Server is listening on port ' +
        server.address().port.toString());
});

wsServer = new WebSocketServer({ httpServer: server });

//shutDown(wsServer);

winston.log('info', 'Server has been initialized');

var connections = {};
var connectionIDCounter = 0;

var connectedDevices = [];

var KIND = {
    'NEW_DEVICE' : 'NEW_DEVICE',
    'DEVICE_EXISTS' : 'DEVICE_EXISTS',
    'REGISTER_DEVICE' : 'REGISTER_DEVICE',
    'SET_VIEW' : 'SET_VIEW',
    'NEW_GUID' : 'NEW_GUID',
    'SYNC_COMPOSITION' : 'SYNC_COMPOSITION',
    'SYNC_VIEW' : 'SYNC_VIEW'
}

/**
 * Event when connection is incoming
 */
wsServer.on('connect', function(connection) {
    winston.log('info', 'Incoming connection', connection.remoteAddress);
})

/**
 * Event when request is incoming
 */
wsServer.on('request', function(request) {

    var connection = request.accept('echo-protocol', request.origin);

    connection.id = connectionIDCounter++;
    connections[connection.id] = connection;

    winston.log('info', (new Date()) + ' Connection ID ' + connection.id + ' accepted.');

    /**
     * Event when when message from connection is incoming
     */
    connection.on('message', function(message) {

        var msg = getUTF8Data(message);

        switch (msg.kind) {
            case KIND.NEW_DEVICE:

                this.guid = generateUniqueDeviceKey();

                sendToConnectionId(this.id,
                    generateMessage(KIND.NEW_GUID, { guid: this.guid }));

                break;
            case KIND.DEVICE_EXISTS:
                this.guid = msg.data.guid;

                break;
            case KIND.REGISTER_DEVICE:
                addDevice(this.id, this.guid, msg.data);
                packDevices();
                broadcast(undefined,
                    generateMessage(KIND.SYNC_COMPOSITION,
                        connectedDevices));
                break;
            case KIND.SET_VIEW:
                console.log('Received Message: ' + msg);

                var tmp = JSON.parse(msg.data);
                tmp.composition = connectedDevices;

                broadcast(this.id, generateMessage(KIND.SYNC_VIEW, tmp));

                break;
        }

    });

    /**
     * Event when connection is closing
     */
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected. ' +
            "Connection ID: " + connection.id);

        // Make sure to remove closed connections from the global pool
        delete connections[connection.id];
        //removeDevice(connection.id);
    });
});

/**
 * Broadcast to all open connections
 *
 * @param masterId
 * @param data
 */
function broadcast(masterId, data) {
    Object.keys(connections).forEach(function(key) {
        var connection = connections[key];
        if (connection.connected && connection.id !== masterId) {
            connection.send(data);
        }
    });
}

/**
 * Send a message to a connection by its connectionID
 *
 * @param connectionID
 * @param data
 */
function sendToConnectionId(connectionID, data) {
    var connection = connections[connectionID];
    if (connection && connection.connected) {
        connection.send(data);
    }
}

/**
 * Add new device
 *
 * @param id
 * @param guid
 * @param data
 */
function addDevice(id, guid, data) {
    data.id = id;
    data.guid = guid

    if(connectedDevices.length) {

        Object.keys(connectedDevices).forEach(function (key) {

            if (guid === connectedDevices[key].guid) {

                connectedDevices[key].w = data.w;
                connectedDevices[key].h = data.h;

            } else {
                connectedDevices.push(data);
            }
        });

    } else {
        connectedDevices.push(data);
    }

}

/**
 * Remove device from connectedDevices
 *
 * @param id
 */
function removeDevice(id) {
    Object.keys(connectedDevices).forEach(function(key) {
        var connectedDevice = connectedDevices[key];
        if(connectedDevice.id === id) {
            connectedDevices.splice(key, 1);
        }
    });
}


/**
 * Bin-pack devices
 */
function packDevices() {
    var GrowingPacker = binpacking.GrowingPacker;
    var packer = new GrowingPacker;

    connectedDevices.sort(function(a,b) { return (b.h < a.h); });
    packer.fit(connectedDevices);
}

/**
 * Generate unique device key
 */
function generateUniqueDeviceKey() {
    return (new Chance()).guid();
}

/**
 * Generate new message
 *
 * @param kind
 * @param data
 */
function generateMessage(kind, data) {
    return JSON.stringify({
        kind: kind,
        data: data
    });
}


/**
 * Get parsed data from WebSocket message
 *
 * @param message
 */
function getUTF8Data(message) {
    return JSON.parse(message.utf8Data)
}

function closeAllConnections(webSocket) {
    webSocket.closeAllConnections();
}

function shutDown(websocket) {
    winston.log('warn', 'Server will be shutted down');
    websocket.shutDown();

    winston.log('warn', 'Killing node process');
    process.exit();
}
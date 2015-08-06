var WebSocketServer = require('websocket').server,
    http = require('http'),
    binpacking = require('binpacking'), //https://github.com/jsmarkus/node-bin-packing
    Chance = require('chance');

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

var connections = {};
var connectionIDCounter = 0;

var connectedDevices = [];

var KIND = {
    'SEND_GUID' : 'SEND_GUID',
    'REGISTER_DEVICE' : 'REGISTER_DEVICE',
    'SET_VIEW' : 'SET_VIEW',
    'GENERATE_GUID' : 'GENERATE_GUID',
    'SYNC_COMPOSITION' : 'SYNC_COMPOSITION',
    'SYNC_VIEW' : 'SYNC_VIEW'
}

wsServer.on('request', function(request) {

    var connection = request.accept('echo-protocol', request.origin);

    // Store a reference to the connection using an incrementing ID
    connection.id = connectionIDCounter++;
    connections[connection.id] = connection;

    // Generate GUID
    //connection.guid = generateUniqueDeviceKey();

    console.log((new Date()) + ' Connection ID ' + connection.id + ' accepted.');


    //TODO check if device already has GUID and is in connected devices - if yes then dont send anything
    //sendToConnectionId(connection.id,
    //    generateMessage(RESPONSE_KIND.GENERATE_GUID, { guid: connection.guid }));

    connection.on('message', function(message) {

        var response = getUTF8Data(message);

        switch (response.kind) {
            case KIND.REGISTER_DEVICE:
                addDevice(this.id, response.data);
                packDevices();
                broadcast(undefined,
                    generateMessage(KIND.SYNC_COMPOSITION,
                        connectedDevices));
                break;
            case KIND.SET_VIEW:
                console.log('Received Message: ' + response);

                var tmp = JSON.parse(response.data);
                tmp.composition = connectedDevices;

                broadcast(this.id, generateMessage(KIND.SYNC_VIEW, tmp));

                break;
        }

    });

    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected. ' +
            "Connection ID: " + connection.id);

        // Make sure to remove closed connections from the global pool
        delete connections[connection.id];
        //removeDevice(connection.id);
    });
});

// Broadcast to all open connections
function broadcast(masterId, data) {
    Object.keys(connections).forEach(function(key) {
        var connection = connections[key];
        if (connection.connected && connection.id !== masterId) {
            connection.send(data);
        }
    });
}

// Send a message to a connection by its connectionID
function sendToConnectionId(connectionID, data) {
    var connection = connections[connectionID];
    if (connection && connection.connected) {
        connection.send(data);
    }
}

function addDevice(id, data) {
    data.id = id;
    connectedDevices.push(data);
}

function removeDevice(id) {
    Object.keys(connectedDevices).forEach(function(key) {
        var connectedDevice = connectedDevices[key];
        if(connectedDevice.id === id) {
            connectedDevices.splice(key, 1);
        }
    });
    console.log(connectedDevices);
}

function packDevices() {
    console.log(connectedDevices);
    var GrowingPacker = binpacking.GrowingPacker;
    var packer = new GrowingPacker;

    connectedDevices.sort(function(a,b) { return (b.h < a.h); });
    packer.fit(connectedDevices);
}

function generateUniqueDeviceKey() {
    return (new Chance()).guid();
}


function generateMessage(kind, data) {
    return JSON.stringify({
        kind: kind,
        data: data
    });
}

function getUTF8Data(message) {
    return JSON.parse(message.utf8Data)
}
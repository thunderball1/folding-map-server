var WebSocketServer = require('websocket').server,
    http = require('http'),
    binpacking = require('binpacking'), //https://github.com/jsmarkus/node-bin-packing
    Chance = require('chance');

var port = 3002;

var connectedDevices = [];

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

wsServer.on('request', function(request) {

    var connection = request.accept('echo-protocol', request.origin);

    // Store a reference to the connection using an incrementing ID
    connection.id = connectionIDCounter++;
    connections[connection.id] = connection;

    // Now you can access the connection with connections[id] and find out
    // the id for a connection with connection.id

    console.log((new Date()) + ' Connection ID ' + connection.id + ' accepted.');


    sendToConnectionId(connection.id, JSON.stringify({
        guid: generateUniqueDeviceKey()
    }));

    connection.on('message', function(message) {

        var parsedMessage = JSON.parse(message.utf8Data);

        if (isInitialMessage(parsedMessage)) {
            addNewDevice(this.id, parsedMessage);
            packDevices();

            console.log('Sending initial response...')
        } else {
            console.log('Received Message: ' + message.utf8Data);
            //connection.sendUTF(message.utf8Data);
            parsedMessage.composition = connectedDevices;
            broadcast(this.id, JSON.stringify(parsedMessage))
        }

    });

    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected. ' +
            "Connection ID: " + connection.id);

        // Make sure to remove closed connections from the global pool
        delete connections[connection.id];
    });
});

function isInitialMessage(message) {
    return message.hasOwnProperty('h') && message.
            hasOwnProperty('w');
}

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

function addNewDevice(id, data) {
    data.id = id;
    connectedDevices.push(data);
    console.log(connectedDevices);
}

function packDevices() {
    var GrowingPacker = binpacking.GrowingPacker;
    var packer = new GrowingPacker;

    connectedDevices.sort(function(a,b) { return (b.h < a.h); });
    packer.fit(connectedDevices);
    return connectedDevices;
}

function generateUniqueDeviceKey() {
    return (new Chance()).guid();
}
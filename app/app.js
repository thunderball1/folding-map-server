var WebSocketServer = require('websocket').server;
var http = require('http');
var port = 8080;

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

    connection.on('message', function(message) {

        console.log(message);

        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
            //connection.sendUTF(message.utf8Data);
            broadcast(message.utf8Data, this.id)

        }

        //connection.send('Message back')
    });

    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected. ' +
            "Connection ID: " + connection.id);

        // Make sure to remove closed connections from the global pool
        delete connections[connection.id];
    });
});

// Broadcast to all open connections
function broadcast(data, masterId) {
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
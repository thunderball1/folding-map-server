var WebSocketServer = require('websocket').server;
var http = require('http');

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
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

        console.log(message)

        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
            //connection.sendUTF(message.utf8Data);
            broadcast(message.utf8Data)

        }

        //connection.send('Message back')
    })

    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected. ' +
            "Connection ID: " + connection.id);

        // Make sure to remove closed connections from the global pool
        delete connections[connection.id];
    });
});

// Broadcast to all open connections
function broadcast(data) {
    Object.keys(connections).forEach(function(key) {
        var connection = connections[key];
        if (connection.connected) {

            // lng on client is 0.7 so map will be moved a bit
            var dummyLocationData = {
                lat: 51.3,
                lng: 1.3,
                zoom: 9
            };

            connection.send(JSON.stringify(dummyLocationData));
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
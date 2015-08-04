var WebSocketServer = require('websocket').server;
var http = require('http');
var port = 3002;

//var Packer = require('./packer.js');
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

    connection.on('message', function(message) {

        var parsedMessage = JSON.parse(message.utf8Data);

        if (isInitialMessage(parsedMessage)) {
            addNewDevice(this.id, parsedMessage);
            packDevices();
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
    connectedDevices.sort(function(a,b) { return (b.h < a.h); });
    var packer = new Packer(5000, 5000);
    packer.fit(connectedDevices);
    return connectedDevices;
}


Packer = function(w, h) {
    this.init(w, h);
};

Packer.prototype = {

    init: function(w, h) {
        this.root = { x: 0, y: 0, w: w, h: h };
    },

    fit: function(blocks) {
        var n, node, block;
        for (n = 0; n < blocks.length; n++) {
            block = blocks[n];
            if (node = this.findNode(this.root, block.w, block.h))
                block.fit = this.splitNode(node, block.w, block.h);
        }
    },

    findNode: function(root, w, h) {
        if (root.used)
            return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
        else if ((w <= root.w) && (h <= root.h))
            return root;
        else
            return null;
    },

    splitNode: function(node, w, h) {
        node.used = true;
        node.down  = { x: node.x,     y: node.y + h, w: node.w,     h: node.h - h };
        node.right = { x: node.x + w, y: node.y,     w: node.w - w, h: h          };
        return node;
    }

}
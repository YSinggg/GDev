const http = require('http');
const crypto = require('crypto');
const url = require('url');

const rooms = {};

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return;
    }

    if (parsedUrl.pathname === '/api/create' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const roomId = crypto.randomBytes(3).toString('hex').toUpperCase();
            rooms[roomId] = {
                clients: [],
                nextId: 1 // Host is always 0, so next starts at 1
            };
            res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
            res.end(JSON.stringify({ roomId }));
        });
    } else if (parsedUrl.pathname === '/api/join' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { roomId } = JSON.parse(body);
                if (rooms[roomId]) {
                    const playerId = rooms[roomId].nextId++;
                    res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
                    res.end(JSON.stringify({ success: true, playerId }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json', ...headers });
                    res.end(JSON.stringify({ success: false, error: 'Room not found' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json', ...headers });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
    } else if (parsedUrl.pathname === '/api/signal' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { roomId, event, data } = JSON.parse(body);
                if (rooms[roomId]) {
                    // Broadcast to all clients in the room
                    rooms[roomId].clients.forEach(client => {
                        client.write(`data: ${JSON.stringify({ event, data })}\n\n`);
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(404, { ...headers });
                    res.end();
                }
            } catch (e) {
                res.writeHead(400, { ...headers });
                res.end();
            }
        });
    } else if (parsedUrl.pathname === '/events') {
        const roomId = parsedUrl.query.roomId;
        if (rooms[roomId]) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                ...headers
            });

            const client = res;
            rooms[roomId].clients.push(client);

            req.on('close', () => {
                if (rooms[roomId]) {
                    rooms[roomId].clients = rooms[roomId].clients.filter(c => c !== client);
                    if (rooms[roomId].clients.length === 0) {
                         delete rooms[roomId];
                    }
                }
            });
        } else {
            res.writeHead(404, { ...headers });
            res.end();
        }
    } else {
        res.writeHead(404, { ...headers });
        res.end();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

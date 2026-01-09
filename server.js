
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const rooms = {}; // { roomCode: [response_objects] }

const MIME_TYPES = {
    '.html': 'text/html',
    '.svg': 'image/svg+xml',
    '.js': 'text/javascript',
    '.css': 'text/css'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // 1. Static File Serving
    if (req.method === 'GET' && !parsedUrl.pathname.startsWith('/events')) {
        let reqPath = parsedUrl.pathname;
        if (reqPath === '/') reqPath = '/snake.html';

        // Security: Prevent directory traversal
        const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(__dirname, safePath);

        // Ensure file is within root directory (simple check for this flat project)
        if (!filePath.startsWith(__dirname)) {
            res.writeHead(403); res.end('403 Forbidden');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'text/plain';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if(err.code === 'ENOENT') {
                    res.writeHead(404); res.end('404 Not Found');
                } else {
                    res.writeHead(500); res.end('500 Server Error');
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
        return;
    }

    // 2. SSE Endpoint (Subscribe)
    if (parsedUrl.pathname === '/events' && req.method === 'GET') {
        const roomCode = parsedUrl.query.room;
        if (!roomCode) {
            res.writeHead(400); res.end('Missing room code');
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        if (!rooms[roomCode]) rooms[roomCode] = [];
        rooms[roomCode].push(res);

        // Keep-alive heartbeat
        const heartbeat = setInterval(() => {
            res.write(': heartbeat\n\n');
        }, 15000);

        req.on('close', () => {
            clearInterval(heartbeat);
            if (rooms[roomCode]) {
                rooms[roomCode] = rooms[roomCode].filter(client => client !== res);
                if (rooms[roomCode].length === 0) delete rooms[roomCode];
            }
        });
        return;
    }

    // 3. Action Endpoint (Publish)
    if (parsedUrl.pathname === '/action' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const roomCode = data.room;
                if (rooms[roomCode]) {
                    // Broadcast to all in room
                    const message = `data: ${JSON.stringify(data.payload)}\n\n`;
                    rooms[roomCode].forEach(client => client.write(message));
                }
                res.writeHead(200); res.end('OK');
            } catch (e) {
                res.writeHead(400); res.end('Invalid JSON');
            }
        });
        return;
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});

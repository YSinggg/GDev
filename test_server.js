const http = require('http');

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data ? JSON.parse(data) : {}));
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTest() {
    try {
        console.log('1. Creating Room...');
        const createRes = await request('POST', '/api/create', {});
        console.log('Room Created:', createRes);
        const roomId = createRes.roomId;

        console.log('2. Joining Room...');
        const joinRes = await request('POST', '/api/join', { roomId });
        console.log('Joined Room:', joinRes);

        console.log('3. Listening for Events (SSE)...');
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: `/events?roomId=${roomId}`,
            method: 'GET'
        }, res => {
            res.on('data', chunk => {
                const msg = chunk.toString();
                if (msg.includes('TEST_EVENT')) {
                    console.log('PASS: Received Event:', msg);
                    process.exit(0);
                }
            });
        });
        req.end();

        // Give it a moment to connect
        await new Promise(r => setTimeout(r, 500));

        console.log('4. Sending Signal...');
        await request('POST', '/api/signal', {
            roomId,
            event: 'TEST_EVENT',
            data: { hello: 'world' }
        });

    } catch (e) {
        console.error('FAIL:', e);
        process.exit(1);
    }
}

runTest();

const fs = require('fs');
const net = require('net');

console.log('--- PostgreSQL System Environment Check ---');

// Check standard PostgreSQL installation directories
const commonPaths = [
  'C:\\Program Files\\PostgreSQL',
  'C:\\Program Files (x86)\\PostgreSQL',
  'C:\\PostgreSQL',
];

commonPaths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log(`[FOUND] Directory exists: ${p}`);
    try {
      const versions = fs.readdirSync(p);
      console.log(`        Subfolders/Versions: ${versions.join(', ')}`);
    } catch (e) {
      console.log(`        Error reading: ${e.message}`);
    }
  } else {
    console.log(`[NOT FOUND] ${p}`);
  }
});

// Check socket connection to port 5432
const socket = new net.Socket();
socket.setTimeout(2000);

socket.on('connect', () => {
  console.log('[PORT 5432] Connection successful! A service is actively listening.');
  socket.destroy();
  process.exit(0);
});

socket.on('timeout', () => {
  console.log('[PORT 5432] Connection timed out (no response).');
  socket.destroy();
  process.exit(0);
});

socket.on('error', (err) => {
  console.log(`[PORT 5432] Connection error: ${err.code} (${err.message})`);
  process.exit(0);
});

console.log('Connecting to 127.0.0.1:5432...');
socket.connect(5432, '127.0.0.1');

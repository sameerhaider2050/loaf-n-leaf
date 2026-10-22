const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Loaf & Leaf POS System...');

// Start Express Backend
const server = spawn('node', ['server/index.js'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
});

// Start Vite Client
const client = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, 'client'),
});

function cleanup() {
  console.log('\nShutting down Loaf & Leaf services...');
  server.kill();
  client.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

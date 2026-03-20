import * as pty from 'node-pty';
import os from 'os';

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

console.log('Spawning', shell);

const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env as Record<string, string>
});

ptyProcess.onData((data) => {
  console.log('Received data:', JSON.stringify(data));
  if (data.includes('PS ') || data.includes('$') || data.includes('#')) {
    console.log('Prompt detected, exiting...');
    ptyProcess.kill();
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('Timeout reached');
  ptyProcess.kill();
  process.exit(1);
}, 5000);

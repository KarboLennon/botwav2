// Simple test script to check QR code generation
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

console.log('Testing WhatsApp QR Code...');
console.log('This may take a few minutes on first run (downloading Chromium)...\n');

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './session',
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
});

client.on('qr', async (qr) => {
  console.log('\n========================================');
  console.log('QR CODE RECEIVED!');
  console.log('========================================\n');
  
  // Show in terminal (larger size)
  qrcode.generate(qr, { small: false });
  
  // Save to file
  try {
    await QRCode.toFile('qr-code.png', qr, {
      width: 400,
      margin: 2,
    });
    console.log('\n✓ QR Code saved to: qr-code.png');
    console.log('  Open this file if terminal QR is not readable\n');
  } catch (error) {
    console.error('Failed to save QR:', error);
  }
});

client.on('ready', () => {
  console.log('\n✓ Client is ready!');
  console.log('✓ Authentication successful!');
  process.exit(0);
});

client.on('authenticated', () => {
  console.log('✓ Authenticated');
});

client.on('auth_failure', (msg) => {
  console.error('✗ Authentication failed:', msg);
  process.exit(1);
});

client.on('loading_screen', (percent, message) => {
  console.log(`Loading: ${percent}% - ${message}`);
});

console.log('Initializing WhatsApp client...');
client.initialize();

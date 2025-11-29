import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcodeTerminal from 'qrcode-terminal';
import * as QRCode from 'qrcode';
import * as path from 'path';
import { Logger } from '../logger/Logger';

export class WhatsAppClientManager {
  private client: Client | null = null;
  private logger: Logger;
  private sessionDirectory: string;
  private isClientReady: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(logger: Logger, sessionDirectory: string = './session') {
    this.logger = logger;
    this.sessionDirectory = sessionDirectory;
  }

  /**
   * Initialize WhatsApp client
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing WhatsApp client...');

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: this.sessionDirectory,
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

    this.setupEventHandlers();

    await this.client.initialize();
  }

  /**
   * Setup event handlers for WhatsApp client
   */
  private setupEventHandlers(): void {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // QR Code event - for first time authentication
    this.client.on('qr', async (qr) => {
      this.logger.info('QR Code received. Please scan with your WhatsApp:');
      
      // Display QR in terminal with larger size for better scanning
      console.log('\n========================================');
      console.log('SCAN QR CODE BELOW:');
      console.log('========================================\n');
      qrcodeTerminal.generate(qr, { small: false });
      console.log('\n========================================');
      
      // Also save QR code as image file
      try {
        const qrPath = path.join(process.cwd(), 'qr-code.png');
        await QRCode.toFile(qrPath, qr, {
          width: 400,
          margin: 2,
        });
        console.log(`\n✓ QR Code juga disimpan di: ${qrPath}`);
        console.log('  Buka file tersebut jika QR di terminal tidak terbaca\n');
        this.logger.info(`QR Code saved to: ${qrPath}`);
      } catch (error) {
        this.logger.error('Failed to save QR code image', error as Error);
      }
    });

    // Ready event - client is authenticated and ready
    this.client.on('ready', () => {
      this.isClientReady = true;
      this.reconnectAttempts = 0;
      this.logger.info('WhatsApp client is ready!');
    });

    // Authenticated event - session is valid
    this.client.on('authenticated', () => {
      this.logger.info('WhatsApp client authenticated successfully');
    });

    // Authentication failure event
    this.client.on('auth_failure', (msg) => {
      this.logger.error('Authentication failed', new Error(msg));
      this.isClientReady = false;
    });

    // Disconnected event - handle reconnection
    this.client.on('disconnected', (reason) => {
      this.logger.warn('WhatsApp client disconnected', { reason });
      this.isClientReady = false;
      this.handleDisconnect();
    });

    // Loading screen event
    this.client.on('loading_screen', (percent, message) => {
      this.logger.info(`Loading: ${percent}% - ${message}`);
    });
  }

  /**
   * Handle disconnect and attempt reconnection
   */
  private async handleDisconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        'Max reconnection attempts reached',
        new Error('Failed to reconnect to WhatsApp')
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.logger.info(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.initialize();
    } catch (error) {
      this.logger.error('Reconnection failed', error as Error);
    }
  }

  /**
   * Get WhatsApp client instance
   */
  getClient(): Client {
    if (!this.client) {
      throw new Error('Client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.isClientReady;
  }

  /**
   * Disconnect client gracefully
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.logger.info('Disconnecting WhatsApp client...');
      await this.client.destroy();
      this.isClientReady = false;
      this.logger.info('WhatsApp client disconnected');
    }
  }

  /**
   * Get client info
   */
  async getClientInfo(): Promise<any> {
    if (!this.client || !this.isClientReady) {
      throw new Error('Client not ready');
    }

    const info = this.client.info;
    return info;
  }
}

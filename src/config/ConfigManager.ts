import * as fs from 'fs';
import * as path from 'path';
import { BotConfig, NumberMapping } from '../types';

export class ConfigManager {
  private config: BotConfig | null = null;
  private numberMapping: NumberMapping = {};
  private readonly configPath: string;

  constructor(configPath: string = './config.json') {
    this.configPath = configPath;
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<BotConfig> {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.generateDefaultConfig();
        throw new Error(
          `Configuration file not found. A template has been created at ${this.configPath}. ` +
          'Please fill in your phone numbers and restart the bot.'
        );
      }

      const configData = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(configData) as BotConfig;

      if (!this.validateConfig(config)) {
        throw new Error('Invalid configuration. Please check your config.json file.');
      }

      this.config = config;
      this.buildNumberMapping(config);

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config: BotConfig): boolean {
    if (!config.numberA || !config.numberB) {
      console.error('Error: numberA and numberB are required in configuration');
      return false;
    }

    if (!this.validatePhoneNumber(config.numberA)) {
      console.error(`Error: Invalid phone number format for numberA: ${config.numberA}`);
      console.error('Expected format: 628123456789@c.us (international format with country code)');
      return false;
    }

    if (!this.validatePhoneNumber(config.numberB)) {
      console.error(`Error: Invalid phone number format for numberB: ${config.numberB}`);
      console.error('Expected format: 628123456789@c.us (international format with country code)');
      return false;
    }

    return true;
  }

  /**
   * Validate phone number format (international format with country code)
   */
  validatePhoneNumber(number: string): boolean {
    // Format: 628123456789@c.us (country code + number + @c.us)
    const phoneRegex = /^\d{10,15}@c\.us$/;
    return phoneRegex.test(number);
  }

  /**
   * Build bidirectional number mapping
   */
  private buildNumberMapping(config: BotConfig): void {
    this.numberMapping = {
      [config.numberA]: config.numberB,
      [config.numberB]: config.numberA,
    };
  }

  /**
   * Get the relay target for a given number
   */
  getNumberMapping(number: string): string | null {
    return this.numberMapping[number] || null;
  }

  /**
   * Get the current configuration
   */
  getConfig(): BotConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Generate default configuration template
   */
  private generateDefaultConfig(): void {
    const defaultConfig: BotConfig = {
      numberA: '6289635319015@c.us',
      numberB: '6287826991483@c.us',
      botNumber: '',
      prefixA: '[From A]',
      prefixB: '[From B]',
      retryAttempts: 3,
      retryDelay: 1000,
      maxLogSize: 10,
      logDirectory: './logs',
      sessionDirectory: './session',
    };

    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log(`Default configuration template created at: ${this.configPath}`);
  }

  /**
   * Get prefix for a given sender number
   */
  getPrefix(senderNumber: string): string {
    if (!this.config) {
      return '[Unknown]';
    }

    if (senderNumber === this.config.numberA) {
      return this.config.prefixA;
    } else if (senderNumber === this.config.numberB) {
      return this.config.prefixB;
    }

    return '[Unknown]';
  }
}

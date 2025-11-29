// Type definitions for the WhatsApp Relay Bot

export interface BotConfig {
  numberA: string;
  numberB: string;
  botNumber: string;
  prefixA: string;
  prefixB: string;
  retryAttempts: number;
  retryDelay: number;
  maxLogSize: number;
  logDirectory: string;
  sessionDirectory: string;
}

export interface NumberMapping {
  [key: string]: string;
}

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../logger/Logger';

export interface BotState {
  lastMessageTimestamp: Date | null;
  messageCount: number;
  errorCount: number;
  startTime: Date;
  lastSaveTime: Date;
}

export class StateManager {
  private state: BotState;
  private logger: Logger;
  private stateFilePath: string;

  constructor(logger: Logger, stateDirectory: string = './') {
    this.logger = logger;
    this.stateFilePath = path.join(stateDirectory, 'bot-state.json');
    this.state = this.getDefaultState();
  }

  /**
   * Get default state
   */
  private getDefaultState(): BotState {
    return {
      lastMessageTimestamp: null,
      messageCount: 0,
      errorCount: 0,
      startTime: new Date(),
      lastSaveTime: new Date(),
    };
  }

  /**
   * Load state from disk
   */
  async loadState(): Promise<BotState> {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        this.logger.info('No existing state file found, using default state');
        return this.state;
      }

      const stateData = fs.readFileSync(this.stateFilePath, 'utf-8');
      const loadedState = JSON.parse(stateData);

      // Convert date strings back to Date objects
      if (loadedState.lastMessageTimestamp) {
        loadedState.lastMessageTimestamp = new Date(loadedState.lastMessageTimestamp);
      }
      if (loadedState.startTime) {
        loadedState.startTime = new Date(loadedState.startTime);
      }
      if (loadedState.lastSaveTime) {
        loadedState.lastSaveTime = new Date(loadedState.lastSaveTime);
      }

      this.state = loadedState;
      this.logger.info('State loaded successfully', {
        messageCount: this.state.messageCount,
        errorCount: this.state.errorCount,
      });

      return this.state;
    } catch (error) {
      this.logger.error('Failed to load state, using default', error as Error);
      return this.state;
    }
  }

  /**
   * Save state to disk
   */
  async saveState(): Promise<void> {
    try {
      this.state.lastSaveTime = new Date();

      const stateDir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }

      fs.writeFileSync(
        this.stateFilePath,
        JSON.stringify(this.state, null, 2),
        'utf-8'
      );

      this.logger.info('State saved successfully');
    } catch (error) {
      this.logger.error('Failed to save state', error as Error);
    }
  }

  /**
   * Update message count
   */
  incrementMessageCount(): void {
    this.state.messageCount++;
    this.state.lastMessageTimestamp = new Date();
  }

  /**
   * Update error count
   */
  incrementErrorCount(): void {
    this.state.errorCount++;
  }

  /**
   * Get current state
   */
  getState(): BotState {
    return { ...this.state };
  }

  /**
   * Reset state
   */
  resetState(): void {
    this.state = this.getDefaultState();
    this.logger.info('State reset to default');
  }

  /**
   * Auto-save state periodically
   */
  startAutoSave(intervalMs: number = 60000): NodeJS.Timeout {
    this.logger.info(`Starting auto-save with interval: ${intervalMs}ms`);

    return setInterval(async () => {
      await this.saveState();
    }, intervalMs);
  }
}

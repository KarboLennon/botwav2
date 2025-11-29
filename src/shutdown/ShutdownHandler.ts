import { Logger } from '../logger/Logger';
import { WhatsAppClientManager } from '../client/WhatsAppClientManager';
import { StateManager } from '../state/StateManager';
import { MemoryManager } from '../memory/MemoryManager';

export class ShutdownHandler {
  private logger: Logger;
  private clientManager: WhatsAppClientManager;
  private stateManager: StateManager;
  private memoryManager: MemoryManager;
  private isShuttingDown: boolean = false;

  constructor(
    logger: Logger,
    clientManager: WhatsAppClientManager,
    stateManager: StateManager,
    memoryManager: MemoryManager
  ) {
    this.logger = logger;
    this.clientManager = clientManager;
    this.stateManager = stateManager;
    this.memoryManager = memoryManager;
  }

  /**
   * Setup shutdown handlers
   */
  setupHandlers(): void {
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT signal');
      await this.gracefulShutdown(0);
    });

    // Handle SIGTERM (kill command)
    process.on('SIGTERM', async () => {
      this.logger.info('Received SIGTERM signal');
      await this.gracefulShutdown(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: Error) => {
      this.logger.error('Uncaught exception', error);
      await this.gracefulShutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason: any) => {
      this.logger.error('Unhandled promise rejection', new Error(String(reason)));
      await this.gracefulShutdown(1);
    });

    this.logger.info('Shutdown handlers registered');
  }

  /**
   * Perform graceful shutdown
   */
  async gracefulShutdown(exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Starting graceful shutdown...');

    try {
      // Stop memory monitoring
      this.logger.info('Stopping memory monitoring...');
      this.memoryManager.stopMonitoring();

      // Save current state
      this.logger.info('Saving bot state...');
      await this.stateManager.saveState();

      // Disconnect WhatsApp client
      this.logger.info('Disconnecting WhatsApp client...');
      await this.clientManager.disconnect();

      this.logger.info('Graceful shutdown completed');
    } catch (error) {
      this.logger.error('Error during graceful shutdown', error as Error);
      exitCode = 1;
    } finally {
      // Give time for final logs to be written
      setTimeout(() => {
        process.exit(exitCode);
      }, 1000);
    }
  }

  /**
   * Handle cleanup on exit
   */
  async cleanup(): Promise<void> {
    this.logger.info('Performing cleanup...');

    try {
      await this.stateManager.saveState();
      this.memoryManager.stopMonitoring();
    } catch (error) {
      this.logger.error('Error during cleanup', error as Error);
    }
  }
}

// Main entry point for WhatsApp Relay Bot
import { Logger } from './logger/Logger';
import { ConfigManager } from './config/ConfigManager';
import { ErrorHandler } from './error/ErrorHandler';
import { WhatsAppClientManager } from './client/WhatsAppClientManager';
import { MessageRelayService } from './relay/MessageRelayService';
import { StateManager } from './state/StateManager';
import { MemoryManager } from './memory/MemoryManager';
import { ShutdownHandler } from './shutdown/ShutdownHandler';

async function main() {
  console.log('WhatsApp Relay Bot - Starting...');
  console.log('=====================================\n');

  let logger: Logger | null = null;
  let shutdownHandler: ShutdownHandler | null = null;

  try {
    // Initialize configuration
    const configManager = new ConfigManager('./config.json');
    const config = await configManager.loadConfig();

    // Initialize logger
    logger = new Logger(config.logDirectory, config.maxLogSize);
    logger.info('WhatsApp Relay Bot starting...');
    logger.info('Configuration loaded successfully', {
      numberA: config.numberA,
      numberB: config.numberB,
    });

    // Initialize error handler
    const errorHandler = new ErrorHandler(
      logger,
      config.retryAttempts,
      config.retryDelay
    );

    // Initialize state manager
    const stateManager = new StateManager(logger);
    await stateManager.loadState();
    stateManager.startAutoSave(60000); // Auto-save every minute

    // Initialize memory manager
    const memoryManager = new MemoryManager(logger, 400, 60000);
    memoryManager.startMonitoring();

    // Initialize WhatsApp client
    const clientManager = new WhatsAppClientManager(logger, config.sessionDirectory);
    
    // Setup shutdown handler
    shutdownHandler = new ShutdownHandler(
      logger,
      clientManager,
      stateManager,
      memoryManager
    );
    shutdownHandler.setupHandlers();

    // Initialize client
    logger.info('Initializing WhatsApp client...');
    await clientManager.initialize();

    // Wait for client to be ready
    logger.info('Waiting for WhatsApp client to be ready...');
    await waitForClientReady(clientManager, logger);

    // Get client info
    const clientInfo = await clientManager.getClientInfo();
    logger.info('Bot connected successfully', {
      number: clientInfo.wid.user,
      platform: clientInfo.platform,
    });

    // Initialize message relay service
    const relayService = new MessageRelayService(
      logger,
      configManager,
      errorHandler,
      clientManager
    );

    // Start listening for messages
    relayService.startListening();

    logger.info('WhatsApp Relay Bot is now running!');
    logger.info('Press Ctrl+C to stop the bot');
    console.log('\n=====================================');
    console.log('✓ Bot is ready and listening for messages');
    console.log('✓ Press Ctrl+C to stop');
    console.log('=====================================\n');

  } catch (error) {
    if (logger) {
      logger.error('Failed to start bot', error as Error);
    } else {
      console.error('Failed to start bot:', error);
    }

    if (shutdownHandler) {
      await shutdownHandler.gracefulShutdown(1);
    } else {
      process.exit(1);
    }
  }
}

/**
 * Wait for WhatsApp client to be ready
 */
async function waitForClientReady(
  clientManager: WhatsAppClientManager,
  logger: Logger,
  maxWaitTime: number = 120000
): Promise<void> {
  const startTime = Date.now();
  const checkInterval = 1000;

  while (!clientManager.isReady()) {
    if (Date.now() - startTime > maxWaitTime) {
      throw new Error('Timeout waiting for WhatsApp client to be ready');
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  logger.info('WhatsApp client is ready');
}

// Start the bot
main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});

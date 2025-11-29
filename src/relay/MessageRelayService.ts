import { Message, MessageMedia } from 'whatsapp-web.js';
import { Logger } from '../logger/Logger';
import { ConfigManager } from '../config/ConfigManager';
import { ErrorHandler } from '../error/ErrorHandler';
import { WhatsAppClientManager } from '../client/WhatsAppClientManager';

export class MessageRelayService {
  private logger: Logger;
  private configManager: ConfigManager;
  private errorHandler: ErrorHandler;
  private clientManager: WhatsAppClientManager;

  constructor(
    logger: Logger,
    configManager: ConfigManager,
    errorHandler: ErrorHandler,
    clientManager: WhatsAppClientManager
  ) {
    this.logger = logger;
    this.configManager = configManager;
    this.errorHandler = errorHandler;
    this.clientManager = clientManager;
  }

  /**
   * Handle incoming message
   */
  async handleIncomingMessage(message: Message): Promise<void> {
    try {
      const from = message.from;
      
      // Get contact info safely (without using getContact which may fail)
      let contactName = 'Unknown';
      try {
        const contact = await message.getContact();
        contactName = contact.pushname || contact.number || from;
      } catch (contactError) {
        // If getContact fails, just use the phone number
        contactName = from;
      }
      
      // Log incoming message
      this.logger.info('Incoming message received', {
        from,
        contactName,
        type: message.type,
        hasMedia: message.hasMedia,
      });

      // Get relay target
      const targetNumber = this.configManager.getNumberMapping(from);

      if (!targetNumber) {
        this.logger.warn('Message from unknown number, ignoring', { from });
        return;
      }

      // Get prefix for sender
      const prefix = this.configManager.getPrefix(from);

      // Relay message based on type
      if (message.hasMedia) {
        // Try to relay media, if fails send error message back to sender
        try {
          await this.relayMediaMessage(from, targetNumber, message, prefix);
        } catch (error) {
          // Send error message back to sender
          await this.sendErrorMessage(
            from,
            'jangan ngirim video, kaga bisa dibuka soalnya pake nomor bot gue'
          );
        }
      } else {
        await this.relayTextMessage(from, targetNumber, message.body, prefix);
      }
    } catch (error) {
      await this.errorHandler.handleError(error as Error, {
        operation: 'handleIncomingMessage',
        details: { from: message.from },
      });
    }
  }

  /**
   * Relay text message
   */
  async relayTextMessage(
    from: string,
    to: string,
    text: string,
    prefix: string
  ): Promise<void> {
    try {
      // Format message with prefix (only add space if prefix exists)
      const formattedMessage = prefix ? `${prefix} ${text}` : text;

      await this.errorHandler.retryWithBackoff(
        async () => {
          const client = this.clientManager.getClient();
          await client.sendMessage(to, formattedMessage);
        },
        'relayTextMessage'
      );

      this.logger.info('Text message relayed successfully', {
        from,
        to,
        messageLength: text.length,
      });
    } catch (error) {
      this.logger.error('Failed to relay text message', error as Error);
      this.errorHandler.handleGracefulFailure('relayTextMessage', error as Error);
      throw error;
    }
  }

  /**
   * Relay media message
   */
  async relayMediaMessage(
    from: string,
    to: string,
    message: Message,
    prefix: string
  ): Promise<void> {
    try {
      const media = await this.downloadMedia(message);

      if (!media) {
        throw new Error('Failed to download media');
      }

      // Format caption with prefix (only add space if prefix exists)
      let caption = '';
      if (message.body) {
        caption = prefix ? `${prefix} ${message.body}` : message.body;
      } else if (prefix) {
        caption = prefix;
      }

      await this.errorHandler.retryWithBackoff(
        async () => {
          const client = this.clientManager.getClient();
          await client.sendMessage(to, media, { caption: caption || undefined });
        },
        'relayMediaMessage'
      );

      this.logger.info('Media message relayed successfully', {
        from,
        to,
        mediaType: media.mimetype,
      });
    } catch (error) {
      this.logger.error('Failed to relay media message', error as Error);
      this.errorHandler.handleGracefulFailure('relayMediaMessage', error as Error);
      throw error;
    }
  }

  /**
   * Download media from message
   */
  private async downloadMedia(message: Message): Promise<MessageMedia | null> {
    try {
      this.logger.info('Downloading media...');

      const media = await this.errorHandler.retryWithBackoff(
        async () => {
          return await message.downloadMedia();
        },
        'downloadMedia'
      );

      if (!media) {
        throw new Error('Media download returned null');
      }

      this.logger.info('Media downloaded successfully', {
        mimetype: media.mimetype,
        size: media.data.length,
      });

      return media;
    } catch (error) {
      this.logger.error('Failed to download media', error as Error);
      return null;
    }
  }

  /**
   * Send error message back to sender
   */
  private async sendErrorMessage(to: string, errorText: string): Promise<void> {
    try {
      const client = this.clientManager.getClient();
      await client.sendMessage(to, errorText);
      this.logger.info('Error message sent to sender', { to });
    } catch (error) {
      this.logger.error('Failed to send error message', error as Error);
    }
  }

  /**
   * Start listening for messages
   */
  startListening(): void {
    const client = this.clientManager.getClient();

    client.on('message', async (message) => {
      await this.handleIncomingMessage(message);
    });

    this.logger.info('Message relay service started listening');
  }
}

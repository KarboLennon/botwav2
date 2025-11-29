import { Logger } from '../logger/Logger';

export interface QueuedMessage {
  id: string;
  to: string;
  content: any;
  type: 'text' | 'media';
  timestamp: Date;
  retryCount: number;
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private logger: Logger;
  private isProcessing: boolean = false;
  private rateLimitDelay: number = 1000; // 1 second between messages
  private isRateLimited: boolean = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Add message to queue
   */
  enqueue(message: QueuedMessage): void {
    this.queue.push(message);
    this.logger.info('Message added to queue', {
      queueSize: this.queue.length,
      messageId: message.id,
    });

    // Start processing if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Get next message from queue
   */
  dequeue(): QueuedMessage | undefined {
    return this.queue.shift();
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Set rate limit status
   */
  setRateLimited(isLimited: boolean, delayMs?: number): void {
    this.isRateLimited = isLimited;
    if (delayMs) {
      this.rateLimitDelay = delayMs;
    }

    if (isLimited) {
      this.logger.warn('Rate limit detected, queuing messages', {
        delay: this.rateLimitDelay,
        queueSize: this.queue.length,
      });
    } else {
      this.logger.info('Rate limit cleared, resuming message processing');
    }
  }

  /**
   * Process queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (!this.isEmpty()) {
      if (this.isRateLimited) {
        this.logger.info('Waiting for rate limit to clear...');
        await this.sleep(this.rateLimitDelay);
      }

      const message = this.dequeue();
      if (message) {
        this.logger.info('Processing queued message', {
          messageId: message.id,
          remainingInQueue: this.queue.length,
        });

        // Add delay between messages to avoid rate limiting
        await this.sleep(this.rateLimitDelay);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear queue
   */
  clear(): void {
    const size = this.queue.length;
    this.queue = [];
    this.logger.info(`Queue cleared, ${size} messages removed`);
  }

  /**
   * Get all queued messages
   */
  getAll(): QueuedMessage[] {
    return [...this.queue];
  }
}

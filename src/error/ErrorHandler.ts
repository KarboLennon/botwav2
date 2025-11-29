import { Logger } from '../logger/Logger';

export interface ErrorContext {
  operation: string;
  details?: any;
}

export class ErrorHandler {
  private logger: Logger;
  private maxRetries: number;
  private initialDelay: number;
  private maxDelay: number;
  private backoffMultiplier: number;

  constructor(
    logger: Logger,
    maxRetries: number = 3,
    initialDelay: number = 1000,
    maxDelay: number = 30000,
    backoffMultiplier: number = 2
  ) {
    this.logger = logger;
    this.maxRetries = maxRetries;
    this.initialDelay = initialDelay;
    this.maxDelay = maxDelay;
    this.backoffMultiplier = backoffMultiplier;
  }

  /**
   * Handle error with context
   */
  async handleError(error: Error, context: ErrorContext): Promise<void> {
    this.logger.error(`Error in ${context.operation}`, error);

    if (context.details) {
      this.logger.info('Error context details', context.details);
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    operation: string,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === retries) {
          this.logger.error(
            `Operation "${operation}" failed after ${retries} retries`,
            lastError
          );
          throw lastError;
        }

        if (!this.shouldRetry(lastError)) {
          this.logger.error(
            `Operation "${operation}" failed with non-retryable error`,
            lastError
          );
          throw lastError;
        }

        const delay = this.calculateBackoff(attempt);
        this.logger.warn(
          `Retry attempt ${attempt + 1}/${retries} for "${operation}" after ${delay}ms`,
          { error: lastError.message }
        );

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Unknown error in retry logic');
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoff(attemptNumber: number): number {
    const delay = this.initialDelay * Math.pow(this.backoffMultiplier, attemptNumber);
    return Math.min(delay, this.maxDelay);
  }

  /**
   * Determine if error should be retried
   */
  shouldRetry(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    // Non-retryable errors
    const nonRetryablePatterns = [
      'invalid configuration',
      'authentication failed',
      'invalid recipient',
      'invalid phone number',
      'banned',
      'unauthorized',
    ];

    for (const pattern of nonRetryablePatterns) {
      if (errorMessage.includes(pattern)) {
        return false;
      }
    }

    // Retryable errors
    const retryablePatterns = [
      'timeout',
      'network',
      'econnrefused',
      'enotfound',
      'rate limit',
      'temporary',
      'unavailable',
    ];

    for (const pattern of retryablePatterns) {
      if (errorMessage.includes(pattern)) {
        return true;
      }
    }

    // Default: retry for unknown errors
    return true;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Handle graceful failure after max retries
   */
  handleGracefulFailure(operation: string, error: Error): void {
    this.logger.error(
      `Graceful failure: Operation "${operation}" could not be completed`,
      error
    );
    this.logger.info('Continuing with other operations...');
  }
}

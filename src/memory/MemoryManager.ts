import { Logger } from '../logger/Logger';

export class MemoryManager {
  private logger: Logger;
  private memoryThresholdMB: number;
  private checkIntervalMs: number;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    logger: Logger,
    memoryThresholdMB: number = 400,
    checkIntervalMs: number = 60000
  ) {
    this.logger = logger;
    this.memoryThresholdMB = memoryThresholdMB;
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Get current memory usage in MB
   */
  getMemoryUsage(): { rss: number; heapUsed: number; heapTotal: number } {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    };
  }

  /**
   * Check if memory usage exceeds threshold
   */
  isMemoryThresholdExceeded(): boolean {
    const usage = this.getMemoryUsage();
    return usage.heapUsed > this.memoryThresholdMB;
  }

  /**
   * Perform memory cleanup
   */
  cleanup(): void {
    this.logger.info('Performing memory cleanup...');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.logger.info('Garbage collection triggered');
    } else {
      this.logger.warn(
        'Garbage collection not available. Run node with --expose-gc flag for manual GC.'
      );
    }

    const usageAfter = this.getMemoryUsage();
    this.logger.info('Memory cleanup completed', {
      heapUsed: usageAfter.heapUsed,
      heapTotal: usageAfter.heapTotal,
    });
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    this.logger.info('Starting memory monitoring', {
      threshold: this.memoryThresholdMB,
      interval: this.checkIntervalMs,
    });

    this.monitoringInterval = setInterval(() => {
      const usage = this.getMemoryUsage();

      this.logger.info('Memory usage', {
        rss: `${usage.rss}MB`,
        heapUsed: `${usage.heapUsed}MB`,
        heapTotal: `${usage.heapTotal}MB`,
      });

      if (this.isMemoryThresholdExceeded()) {
        this.logger.warn('Memory threshold exceeded, triggering cleanup', {
          threshold: this.memoryThresholdMB,
          current: usage.heapUsed,
        });
        this.cleanup();
      }
    }, this.checkIntervalMs);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Memory monitoring stopped');
    }
  }

  /**
   * Log current memory usage
   */
  logMemoryUsage(): void {
    const usage = this.getMemoryUsage();
    this.logger.info('Current memory usage', {
      rss: `${usage.rss}MB`,
      heapUsed: `${usage.heapUsed}MB`,
      heapTotal: `${usage.heapTotal}MB`,
      threshold: `${this.memoryThresholdMB}MB`,
    });
  }
}

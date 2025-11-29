import * as fs from 'fs';
import * as path from 'path';

export interface LogMetadata {
  [key: string]: any;
}

export class Logger {
  private logDirectory: string;
  private maxLogSize: number; // in MB
  private currentLogFile: string;

  constructor(logDirectory: string = './logs', maxLogSize: number = 10) {
    this.logDirectory = logDirectory;
    this.maxLogSize = maxLogSize;
    this.currentLogFile = this.getLogFileName();
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  /**
   * Get log file name based on current date
   */
  private getLogFileName(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDirectory, `bot-${dateStr}.log`);
  }

  /**
   * Write log entry to file
   */
  private writeLog(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data }),
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // Check if we need to rotate log file
    this.rotateLogIfNeeded();

    // Update current log file name (in case date changed)
    const newLogFile = this.getLogFileName();
    if (newLogFile !== this.currentLogFile) {
      this.currentLogFile = newLogFile;
    }

    // Append to log file
    fs.appendFileSync(this.currentLogFile, logLine, 'utf-8');
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: LogMetadata): void {
    this.writeLog('INFO', message, metadata);
    // Don't spam console with info logs
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.writeLog('WARN', message, metadata);
    // Only show warnings in console for important stuff
    if (message.includes('Rate limit') || message.includes('disconnect')) {
      console.warn(`[WARN] ${message}`);
    }
  }

  /**
   * Log error message with stack trace
   */
  error(message: string, error?: Error): void {
    const errorData = error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : undefined;

    this.writeLog('ERROR', message, errorData);
    // Only show critical errors in console
    console.error(`[ERROR] ${message}`);
  }

  /**
   * Rotate log file if it exceeds max size
   */
  rotateLogIfNeeded(): void {
    if (!fs.existsSync(this.currentLogFile)) {
      return;
    }

    const stats = fs.statSync(this.currentLogFile);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB >= this.maxLogSize) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(this.currentLogFile);
      const base = path.basename(this.currentLogFile, ext);
      const dir = path.dirname(this.currentLogFile);
      const rotatedFile = path.join(dir, `${base}-${timestamp}${ext}`);

      fs.renameSync(this.currentLogFile, rotatedFile);
      this.info(`Log file rotated to: ${rotatedFile}`);
    }
  }

  /**
   * Get current log file path
   */
  getCurrentLogFile(): string {
    return this.currentLogFile;
  }
}

/**
 * Comprehensive logging system with different levels and output targets
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  error?: Error;
  context?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  maxLogEntries: number;
  logFilePath?: string;
}

/**
 * Logger interface for different output targets
 */
export interface LogOutput {
  write(entry: LogEntry): Promise<void>;
  flush?(): Promise<void>;
}

/**
 * Console log output implementation
 */
export class ConsoleLogOutput implements LogOutput {
  async write(entry: LogEntry): Promise<void> {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const message = `[${timestamp}] [${levelName}] [${entry.category}] ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.data);
        break;
      case LogLevel.INFO:
        console.info(message, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.data);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message, entry.data);
        if (entry.error) {
          console.error('Error details:', entry.error);
        }
        break;
    }
  }
}

/**
 * Memory log output for storing logs in memory
 */
export class MemoryLogOutput implements LogOutput {
  private entries: LogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  async write(entry: LogEntry): Promise<void> {
    this.entries.unshift(entry);
    
    // Keep only the most recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter(entry => entry.level >= level);
  }

  getEntriesByCategory(category: string): LogEntry[] {
    return this.entries.filter(entry => entry.category === category);
  }

  clear(): void {
    this.entries = [];
  }

  getStats(): {
    totalEntries: number;
    entriesByLevel: Record<string, number>;
    entriesByCategory: Record<string, number>;
  } {
    const entriesByLevel: Record<string, number> = {};
    const entriesByCategory: Record<string, number> = {};

    Object.values(LogLevel).forEach(level => {
      if (typeof level === 'string') {
        entriesByLevel[level] = 0;
      }
    });

    this.entries.forEach(entry => {
      const levelName = LogLevel[entry.level];
      entriesByLevel[levelName] = (entriesByLevel[levelName] || 0) + 1;
      entriesByCategory[entry.category] = (entriesByCategory[entry.category] || 0) + 1;
    });

    return {
      totalEntries: this.entries.length,
      entriesByLevel,
      entriesByCategory
    };
  }
}

/**
 * File log output implementation (for Electron environment)
 */
export class FileLogOutput implements LogOutput {
  private filePath: string;
  private writeQueue: LogEntry[] = [];
  private isWriting: boolean = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async write(entry: LogEntry): Promise<void> {
    this.writeQueue.push(entry);
    
    if (!this.isWriting) {
      await this.flushQueue();
    }
  }

  async flush(): Promise<void> {
    await this.flushQueue();
  }

  private async flushQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      // Only write to file in Electron environment
      if (typeof require !== 'undefined') {
        const fs = require('fs/promises');
        const path = require('path');
        
        // Ensure directory exists
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });

        // Format entries as JSON lines
        const logLines = this.writeQueue.map(entry => 
          JSON.stringify({
            timestamp: entry.timestamp.toISOString(),
            level: LogLevel[entry.level],
            category: entry.category,
            message: entry.message,
            data: entry.data,
            error: entry.error ? {
              name: entry.error.name,
              message: entry.error.message,
              stack: entry.error.stack
            } : undefined,
            context: entry.context
          })
        ).join('\n') + '\n';

        // Append to file
        await fs.appendFile(this.filePath, logLines, 'utf8');
      }
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    } finally {
      this.writeQueue = [];
      this.isWriting = false;
    }
  }
}

/**
 * Main logger class with multiple output targets
 */
export class Logger {
  private config: LoggerConfig;
  private outputs: LogOutput[] = [];
  private memoryOutput: MemoryLogOutput;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      maxLogEntries: 1000,
      ...config
    };

    this.setupOutputs();
  }

  private setupOutputs(): void {
    this.outputs = [];

    // Always add memory output for debugging
    this.memoryOutput = new MemoryLogOutput(this.config.maxLogEntries);
    this.outputs.push(this.memoryOutput);

    // Add console output if enabled
    if (this.config.enableConsole) {
      this.outputs.push(new ConsoleLogOutput());
    }

    // Add file output if enabled and path provided
    if (this.config.enableFile && this.config.logFilePath) {
      this.outputs.push(new FileLogOutput(this.config.logFilePath));
    }
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.setupOutputs();
  }

  /**
   * Log a debug message
   */
  debug(category: string, message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, category, message, data, undefined, context);
  }

  /**
   * Log an info message
   */
  info(category: string, message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, category, message, data, undefined, context);
  }

  /**
   * Log a warning message
   */
  warn(category: string, message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, category, message, data, undefined, context);
  }

  /**
   * Log an error message
   */
  error(category: string, message: string, error?: Error, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, category, message, data, error, context);
  }

  /**
   * Log a fatal error message
   */
  fatal(category: string, message: string, error?: Error, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, category, message, data, error, context);
  }

  /**
   * Core logging method
   */
  private async log(
    level: LogLevel,
    category: string,
    message: string,
    data?: any,
    error?: Error,
    context?: Record<string, any>
  ): void {
    // Check if this log level should be processed
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      error,
      context
    };

    // Write to all outputs
    const writePromises = this.outputs.map(output => 
      output.write(entry).catch(err => 
        console.error('Failed to write log entry:', err)
      )
    );

    await Promise.all(writePromises);
  }

  /**
   * Get log entries from memory
   */
  getLogEntries(): LogEntry[] {
    return this.memoryOutput.getEntries();
  }

  /**
   * Get log entries by level
   */
  getLogEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.memoryOutput.getEntriesByLevel(level);
  }

  /**
   * Get log entries by category
   */
  getLogEntriesByCategory(category: string): LogEntry[] {
    return this.memoryOutput.getEntriesByCategory(category);
  }

  /**
   * Get logging statistics
   */
  getStats(): {
    totalEntries: number;
    entriesByLevel: Record<string, number>;
    entriesByCategory: Record<string, number>;
  } {
    return this.memoryOutput.getStats();
  }

  /**
   * Clear all log entries from memory
   */
  clearLogs(): void {
    this.memoryOutput.clear();
  }

  /**
   * Flush all outputs
   */
  async flush(): Promise<void> {
    const flushPromises = this.outputs
      .filter(output => output.flush)
      .map(output => output.flush!().catch(err => 
        console.error('Failed to flush log output:', err)
      ));

    await Promise.all(flushPromises);
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Record<string, any>): Logger {
    const childLogger = new Logger(this.config);
    
    // Override the log method to include additional context
    const originalLog = (childLogger as any).log.bind(childLogger);
    (childLogger as any).log = async (
      level: LogLevel,
      category: string,
      message: string,
      data?: any,
      error?: Error,
      context?: Record<string, any>
    ) => {
      const mergedContext = { ...additionalContext, ...context };
      return originalLog(level, category, message, data, error, mergedContext);
    };

    return childLogger;
  }
}

/**
 * Default logger categories
 */
export const LogCategories = {
  DOCUMENT_PARSING: 'document_parsing',
  CONTENT_PROCESSING: 'content_processing',
  BATCH_PROCESSING: 'batch_processing',
  FILE_SYSTEM: 'file_system',
  FORMAT_CONVERSION: 'format_conversion',
  USER_INTERFACE: 'user_interface',
  ERROR_HANDLING: 'error_handling',
  SYSTEM: 'system',
  PERFORMANCE: 'performance'
} as const;

/**
 * Global logger instance
 */
export const logger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false, // Enable in production with proper file path
  maxLogEntries: 1000
});

/**
 * Performance logging utility
 */
export class PerformanceLogger {
  private logger: Logger;
  private timers: Map<string, number> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId: string, description: string): void {
    this.timers.set(operationId, Date.now());
    this.logger.debug(LogCategories.PERFORMANCE, `Started: ${description}`, { operationId });
  }

  /**
   * End timing an operation and log the duration
   */
  endTimer(operationId: string, description?: string): number {
    const startTime = this.timers.get(operationId);
    if (!startTime) {
      this.logger.warn(LogCategories.PERFORMANCE, `Timer not found: ${operationId}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operationId);

    this.logger.info(LogCategories.PERFORMANCE, 
      `Completed: ${description || operationId}`, 
      { operationId, duration: `${duration}ms` }
    );

    return duration;
  }

  /**
   * Log memory usage
   */
  logMemoryUsage(context: string): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      this.logger.info(LogCategories.PERFORMANCE, `Memory usage: ${context}`, {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      });
    }
  }
}

/**
 * Global performance logger instance
 */
export const performanceLogger = new PerformanceLogger(logger);
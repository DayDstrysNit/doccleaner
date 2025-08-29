import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  Logger,
  LogLevel,
  LogCategories,
  ConsoleLogOutput,
  MemoryLogOutput,
  FileLogOutput,
  PerformanceLogger,
  logger,
  performanceLogger
} from '../services/logger';

describe('Logger', () => {
  let testLogger: Logger;

  beforeEach(() => {
    testLogger = new Logger({
      level: LogLevel.DEBUG,
      enableConsole: false, // Disable console for tests
      enableFile: false,
      maxLogEntries: 100
    });
  });

  describe('Log Levels', () => {
    it('should log messages at or above configured level', () => {
      const infoLogger = new Logger({ level: LogLevel.INFO, enableConsole: false });
      
      infoLogger.debug('test', 'Debug message');
      infoLogger.info('test', 'Info message');
      infoLogger.warn('test', 'Warning message');
      infoLogger.error('test', 'Error message');

      const entries = infoLogger.getLogEntries();
      expect(entries).toHaveLength(3); // Should exclude debug message
      expect(entries.map(e => e.level)).toEqual([LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO]);
    });

    it('should log all messages when level is DEBUG', () => {
      testLogger.debug('test', 'Debug message');
      testLogger.info('test', 'Info message');
      testLogger.warn('test', 'Warning message');
      testLogger.error('test', 'Error message');
      testLogger.fatal('test', 'Fatal message');

      const entries = testLogger.getLogEntries();
      expect(entries).toHaveLength(5);
    });
  });

  describe('Log Entry Structure', () => {
    it('should create properly structured log entries', () => {
      const testData = { key: 'value' };
      const testContext = { operation: 'test' };
      const testError = new Error('Test error');

      testLogger.error('test_category', 'Test message', testError, testData, testContext);

      const entries = testLogger.getLogEntries();
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.level).toBe(LogLevel.ERROR);
      expect(entry.category).toBe('test_category');
      expect(entry.message).toBe('Test message');
      expect(entry.data).toEqual(testData);
      expect(entry.error).toBe(testError);
      expect(entry.context).toEqual(testContext);
      expect(entry.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Log Filtering', () => {
    beforeEach(() => {
      testLogger.debug('debug_cat', 'Debug message');
      testLogger.info('info_cat', 'Info message');
      testLogger.warn('warn_cat', 'Warning message');
      testLogger.error('error_cat', 'Error message');
      testLogger.fatal('fatal_cat', 'Fatal message');
    });

    it('should filter entries by level', () => {
      const errorEntries = testLogger.getLogEntriesByLevel(LogLevel.ERROR);
      expect(errorEntries).toHaveLength(2); // ERROR and FATAL
      expect(errorEntries.every(e => e.level >= LogLevel.ERROR)).toBe(true);
    });

    it('should filter entries by category', () => {
      const debugEntries = testLogger.getLogEntriesByCategory('debug_cat');
      expect(debugEntries).toHaveLength(1);
      expect(debugEntries[0].category).toBe('debug_cat');
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      testLogger.debug('cat1', 'Debug 1');
      testLogger.debug('cat1', 'Debug 2');
      testLogger.info('cat2', 'Info 1');
      testLogger.error('cat1', 'Error 1');

      const stats = testLogger.getStats();
      expect(stats.totalEntries).toBe(4);
      expect(stats.entriesByLevel['DEBUG']).toBe(2);
      expect(stats.entriesByLevel['INFO']).toBe(1);
      expect(stats.entriesByLevel['ERROR']).toBe(1);
      expect(stats.entriesByCategory['cat1']).toBe(3);
      expect(stats.entriesByCategory['cat2']).toBe(1);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration and recreate outputs', () => {
      const originalConfig = { level: LogLevel.INFO, enableConsole: false };
      const updatedLogger = new Logger(originalConfig);

      updatedLogger.debug('test', 'Should not appear');
      expect(updatedLogger.getLogEntries()).toHaveLength(0);

      updatedLogger.updateConfig({ level: LogLevel.DEBUG });
      updatedLogger.debug('test', 'Should appear');
      expect(updatedLogger.getLogEntries()).toHaveLength(1);
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with additional context', () => {
      const childContext = { userId: '123', sessionId: 'abc' };
      const childLogger = testLogger.child(childContext);

      childLogger.info('test', 'Child message', undefined, { extra: 'data' });

      const entries = childLogger.getLogEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].context).toEqual({
        userId: '123',
        sessionId: 'abc',
        extra: 'data'
      });
    });
  });
});

describe('ConsoleLogOutput', () => {
  let consoleOutput: ConsoleLogOutput;
  let consoleSpy: any;

  beforeEach(() => {
    consoleOutput = new ConsoleLogOutput();
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  it('should write debug messages to console.debug', async () => {
    const entry = {
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      category: 'test',
      message: 'Debug message',
      data: { key: 'value' }
    };

    await consoleOutput.write(entry);
    expect(consoleSpy.debug).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG] [test] Debug message'),
      { key: 'value' }
    );
  });

  it('should write error messages to console.error with error details', async () => {
    const testError = new Error('Test error');
    const entry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      category: 'test',
      message: 'Error message',
      error: testError
    };

    await consoleOutput.write(entry);
    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] [test] Error message'),
      undefined
    );
    expect(consoleSpy.error).toHaveBeenCalledWith('Error details:', testError);
  });
});

describe('MemoryLogOutput', () => {
  let memoryOutput: MemoryLogOutput;

  beforeEach(() => {
    memoryOutput = new MemoryLogOutput(5); // Small limit for testing
  });

  it('should store log entries in memory', async () => {
    const entry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: 'test',
      message: 'Test message'
    };

    await memoryOutput.write(entry);
    const entries = memoryOutput.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(entry);
  });

  it('should maintain maximum number of entries', async () => {
    // Add more entries than the limit
    for (let i = 0; i < 10; i++) {
      await memoryOutput.write({
        timestamp: new Date(),
        level: LogLevel.INFO,
        category: 'test',
        message: `Message ${i}`
      });
    }

    const entries = memoryOutput.getEntries();
    expect(entries).toHaveLength(5); // Should be limited to maxEntries
    expect(entries[0].message).toBe('Message 9'); // Most recent first
  });

  it('should filter entries by level', async () => {
    await memoryOutput.write({
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      category: 'test',
      message: 'Debug'
    });
    await memoryOutput.write({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      category: 'test',
      message: 'Error'
    });

    const errorEntries = memoryOutput.getEntriesByLevel(LogLevel.ERROR);
    expect(errorEntries).toHaveLength(1);
    expect(errorEntries[0].message).toBe('Error');
  });

  it('should filter entries by category', async () => {
    await memoryOutput.write({
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: 'cat1',
      message: 'Message 1'
    });
    await memoryOutput.write({
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: 'cat2',
      message: 'Message 2'
    });

    const cat1Entries = memoryOutput.getEntriesByCategory('cat1');
    expect(cat1Entries).toHaveLength(1);
    expect(cat1Entries[0].message).toBe('Message 1');
  });

  it('should provide statistics', async () => {
    await memoryOutput.write({
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: 'cat1',
      message: 'Info'
    });
    await memoryOutput.write({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      category: 'cat2',
      message: 'Error'
    });

    const stats = memoryOutput.getStats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.entriesByLevel['INFO']).toBe(1);
    expect(stats.entriesByLevel['ERROR']).toBe(1);
    expect(stats.entriesByCategory['cat1']).toBe(1);
    expect(stats.entriesByCategory['cat2']).toBe(1);
  });

  it('should clear all entries', async () => {
    await memoryOutput.write({
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: 'test',
      message: 'Test'
    });

    expect(memoryOutput.getEntries()).toHaveLength(1);
    memoryOutput.clear();
    expect(memoryOutput.getEntries()).toHaveLength(0);
  });
});

describe('FileLogOutput', () => {
  let fileOutput: FileLogOutput;
  const testFilePath = '/tmp/test.log';

  beforeEach(() => {
    fileOutput = new FileLogOutput(testFilePath);
  });

  it('should handle write operations gracefully when fs is not available', async () => {
    const entry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      category: 'test',
      message: 'Test message'
    };

    // Should not throw error even if file system is not available
    await expect(fileOutput.write(entry)).resolves.toBeUndefined();
  });

  it('should handle flush operations gracefully', async () => {
    await expect(fileOutput.flush()).resolves.toBeUndefined();
  });
});

describe('PerformanceLogger', () => {
  let perfLogger: PerformanceLogger;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = new Logger({ enableConsole: false, level: LogLevel.DEBUG });
    perfLogger = new PerformanceLogger(mockLogger);
  });

  it('should track operation timing', async () => {
    const operationId = 'test_operation';
    
    perfLogger.startTimer(operationId, 'Test operation');
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const duration = perfLogger.endTimer(operationId, 'Test operation completed');
    
    expect(duration).toBeGreaterThan(0);
    
    const entries = mockLogger.getLogEntries();
    expect(entries.some(e => e.message.includes('Started: Test operation'))).toBe(true);
    expect(entries.some(e => e.message.includes('Completed: Test operation completed'))).toBe(true);
  });

  it('should handle missing timers gracefully', () => {
    const duration = perfLogger.endTimer('nonexistent_timer');
    expect(duration).toBe(0);
    
    const entries = mockLogger.getLogEntries();
    expect(entries.some(e => e.message.includes('Timer not found'))).toBe(true);
  });

  it('should log memory usage when available', () => {
    // Mock process.memoryUsage
    const originalProcess = global.process;
    (global as any).process = {
      memoryUsage: () => ({
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024, // 10MB
        rss: 200 * 1024 * 1024 // 200MB
      })
    };

    perfLogger.logMemoryUsage('Test context');

    const entries = mockLogger.getLogEntries();
    const memoryEntry = entries.find(e => e.message.includes('Memory usage: Test context'));
    
    expect(memoryEntry).toBeDefined();
    expect(memoryEntry?.data).toEqual({
      heapUsed: '50MB',
      heapTotal: '100MB',
      external: '10MB',
      rss: '200MB'
    });

    // Restore original process
    global.process = originalProcess;
  });
});

describe('Global Logger Instances', () => {
  it('should provide global logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should provide global performance logger instance', () => {
    expect(performanceLogger).toBeInstanceOf(PerformanceLogger);
  });

  it('should have predefined log categories', () => {
    expect(LogCategories.DOCUMENT_PARSING).toBe('document_parsing');
    expect(LogCategories.CONTENT_PROCESSING).toBe('content_processing');
    expect(LogCategories.BATCH_PROCESSING).toBe('batch_processing');
    expect(LogCategories.ERROR_HANDLING).toBe('error_handling');
  });
});
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  configure,
  createScopedLogger,
  LOG_LEVELS,
  debug,
  info,
  warn,
  error as logError,
} from '../../src/lib/logger';
// Aliased 'error' to 'logError' to avoid conflict with any potential 'error' variables.

// Helper to reset logger configuration to a known state before each test
const resetLoggerConfig = () => {
  configure({
    minLevel: LOG_LEVELS.INFO, // Use numeric log level
    timestamps: false, // Corrected key: 'timestamps' not 'includeTimestamp'
    includeContext: true,
    // Reset any other configurations if they are added in the future
  });
};

describe('logger.js', () => {
  let consoleSpies;

  beforeEach(() => {
    // Reset logger to default test configuration
    resetLoggerConfig();

    // Mock console methods
    consoleSpies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console mocks
    consoleSpies.debug.mockRestore();
    consoleSpies.info.mockRestore();
    consoleSpies.warn.mockRestore();
    consoleSpies.error.mockRestore();
  });

  describe('LOG_LEVELS', () => {
    test('should have correct numeric values', () => {
      expect(LOG_LEVELS.DEBUG).toBe(0); // Uppercase
      expect(LOG_LEVELS.INFO).toBe(1); // Uppercase
      expect(LOG_LEVELS.WARN).toBe(2); // Uppercase
      expect(LOG_LEVELS.ERROR).toBe(3); // Uppercase
    });
  });

  describe('configure', () => {
    test('should apply default configuration (implicitly tested by resetLoggerConfig)', () => {
      // resetLoggerConfig applies a known default set for testing
      info('Test message'); // Use imported 'info' directly
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Test message')
      );
    });

    test('should override default configuration', () => {
      configure({ minLevel: LOG_LEVELS.DEBUG, timestamps: true, includeContext: false }); // Corrected key, Numeric level
      debug('Debug message with timestamp'); // Use imported 'debug' directly
      expect(consoleSpies.debug).toHaveBeenCalledTimes(1);
      const debugLog = consoleSpies.debug.mock.calls[0][0];
      expect(debugLog).toContain('[DEBUG] Debug message with timestamp');
      // Extract timestamp part like "[YYYY-MM-DDTHH:mm:ss.sssZ]"
      const debugTimestampPart = debugLog.substring(0, debugLog.indexOf(']') + 1);
      expect(debugTimestampPart).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]$/);

      info('Info message without context', { test: 'context' }); // Use imported 'info' directly
      // When includeContext is false, and timestamps is true:
      expect(consoleSpies.info).toHaveBeenCalledTimes(1);
      const infoLog = consoleSpies.info.mock.calls[0][0];
      expect(infoLog).toContain('[INFO] Info message without context');
      const infoTimestampPart = infoLog.substring(0, infoLog.indexOf(']') + 1);
      expect(infoTimestampPart).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]$/);
      expect(infoLog).not.toContain('{"test":"context"}');
    });

    test('can reset to default configuration by re-calling configure', () => {
      configure({ minLevel: LOG_LEVELS.ERROR }); // Numeric level
      warn('This should not be logged'); // Use imported 'warn' directly
      expect(consoleSpies.warn).not.toHaveBeenCalled();

      resetLoggerConfig(); // Resets to minLevel: LOG_LEVELS.INFO
      warn('This should be logged now'); // Use imported 'warn' directly
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] This should be logged now')
      );
    });
  });

  describe('Logging functions (debug, info, warn, error)', () => {
    // Test cases now use level name for describe blocks and string formatting,
    // but numericLevel for configuration and comparison.
    const testCases = [
      { levelName: 'debug', numericLevel: LOG_LEVELS.DEBUG, fn: debug, consoleMethod: 'debug' },
      { levelName: 'info', numericLevel: LOG_LEVELS.INFO, fn: info, consoleMethod: 'info' },
      { levelName: 'warn', numericLevel: LOG_LEVELS.WARN, fn: warn, consoleMethod: 'warn' },
      { levelName: 'error', numericLevel: LOG_LEVELS.ERROR, fn: logError, consoleMethod: 'error' },
    ];

    testCases.forEach(({ levelName, numericLevel, fn, consoleMethod }) => {
      describe(`${levelName}()`, () => {
        test(`should log when minLevel is ${levelName} or lower`, () => {
          configure({ minLevel: numericLevel });
          fn(`Test ${levelName} message`);
          expect(consoleSpies[consoleMethod]).toHaveBeenCalledWith(
            expect.stringContaining(`[${levelName.toUpperCase()}] Test ${levelName} message`)
          );
        });

        test('should not log when minLevel is higher', () => {
          const higherLevelValue = numericLevel + 1;
          // Find a level name for this higher value, if one exists
          const higherLevelKey = Object.keys(LOG_LEVELS).find(
            (k) => LOG_LEVELS[k] === higherLevelValue
          );

          if (higherLevelKey) {
            // If a higher level exists
            configure({ minLevel: higherLevelValue });
            fn(`Test ${levelName} message`);
            expect(consoleSpies[consoleMethod]).not.toHaveBeenCalled();
          } else {
            // This case means 'numericLevel' is already the highest (error), so it cannot be suppressed by a higher minLevel.
            // The test for "should log when minLevel is error" covers this.
            expect(true).toBe(true);
          }
        });

        test('should call the correct console method', () => {
          configure({ minLevel: LOG_LEVELS.DEBUG }); // Ensure all levels are logged
          fn('Test message');
          expect(consoleSpies[consoleMethod]).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('formatLogMessage (tested via public log functions)', () => {
    test('should include timestamp when configured', () => {
      configure({ timestamps: true, minLevel: LOG_LEVELS.INFO }); // Corrected key
      info('Message with timestamp'); // Use imported 'info'
      expect(consoleSpies.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpies.info.mock.calls[0][0];
      expect(logOutput).toContain('[INFO] Message with timestamp');
      const timestampPart = logOutput.substring(0, logOutput.indexOf(']') + 1);
      expect(timestampPart).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]$/);
    });

    test('should exclude timestamp when configured', () => {
      configure({ timestamps: false, minLevel: LOG_LEVELS.INFO }); // Corrected key
      info('Message without timestamp'); // Use imported 'info'
      expect(consoleSpies.info).toHaveBeenCalledWith('[INFO] Message without timestamp');
    });

    test('should include context when configured', () => {
      configure({ includeContext: true, minLevel: LOG_LEVELS.INFO, timestamps: false }); // Explicitly set timestamps: false for stable check
      info('Message with context', { data: 'value' }); // Use imported 'info'
      expect(consoleSpies.info).toHaveBeenCalledWith(
        '[INFO] Message with context - {"data":"value"}'
      );
    });

    test('should exclude context when configured', () => {
      configure({ includeContext: false, minLevel: LOG_LEVELS.INFO, timestamps: false }); // Explicitly set timestamps: false
      info('Message without context', { data: 'value' }); // Use imported 'info'
      expect(consoleSpies.info).toHaveBeenCalledWith('[INFO] Message without context');
      expect(consoleSpies.info).not.toHaveBeenCalledWith(
        expect.stringContaining('{"data":"value"}')
      );
    });

    test('should handle context serialization errors gracefully', () => {
      configure({ includeContext: true, minLevel: LOG_LEVELS.INFO, timestamps: false }); // Explicitly set timestamps: false
      const circularContext = {};
      circularContext.self = circularContext;

      info('Message with circular context', circularContext); // Use imported 'info'
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining(
          '[INFO] Message with circular context - [Context serialization error]'
        )
      );

      // Also check console.warn was called for the serialization error itself
      // This assumes the logger uses its own 'warn' function for this internal warning.
      // If it directly calls console.warn, this test needs adjustment or clarification on logger's internal behavior.
      // Based on logger.js, formatLogMessage itself does not log, the main log functions (info, warn etc.) call it.
      // The logger.js doesn't show an explicit logger.warn for serialization failure, formatLogMessage returns a string.
      // The test should be that the main log function (e.g. info) still logs *something* for the original message.
      // The current test for consoleSpies.info for the main message is correct.
      // Let's verify if the logger.js actually has a fallback to log a warning *about* the serialization.
      // Reading logger.js: formatLogMessage returns '[Context serialization error]'. It does not call warn itself.
      // So, the additional expect(consoleSpies.warn) for this case might be incorrect.
      // Removing it for now as per current understanding of logger.js provided.
      // If the requirement is that serialization errors *also* produce a separate warning log, logger.js would need to do that.
    });
  });

  describe('createScopedLogger', () => {
    let scopedLogger;
    const scopeName = 'TestScope';

    beforeEach(() => {
      // Ensure global logger is set to a low level for these tests
      // also explicitly set timestamps to false for stable scoped message checks unless testing timestamps
      configure({ minLevel: LOG_LEVELS.DEBUG, includeContext: true, timestamps: false });
      scopedLogger = createScopedLogger(scopeName);
    });

    const scopedTestCases = [
      {
        levelName: 'debug',
        numericLevel: LOG_LEVELS.DEBUG,
        fnName: 'debug',
        consoleMethod: 'debug',
      },
      { levelName: 'info', numericLevel: LOG_LEVELS.INFO, fnName: 'info', consoleMethod: 'info' },
      { levelName: 'warn', numericLevel: LOG_LEVELS.WARN, fnName: 'warn', consoleMethod: 'warn' },
      {
        levelName: 'error',
        numericLevel: LOG_LEVELS.ERROR,
        fnName: 'error',
        consoleMethod: 'error',
      },
    ];

    scopedTestCases.forEach(({ levelName, numericLevel, fnName, consoleMethod }) => {
      test(`scoped ${fnName}() should log with scope in context`, () => {
        scopedLogger[fnName](`Scoped ${levelName} message`);
        expect(consoleSpies[consoleMethod]).toHaveBeenCalledWith(
          expect.stringContaining(
            `[${levelName.toUpperCase()}] Scoped ${levelName} message - {"scope":"${scopeName}"}`
          )
        );
      });

      test(`scoped ${fnName}() should merge scope with existing context`, () => {
        scopedLogger[fnName](`Scoped ${levelName} message with context`, { custom: 'data' });
        expect(consoleSpies[consoleMethod]).toHaveBeenCalledWith(
          expect.stringContaining(
            `[${levelName.toUpperCase()}] Scoped ${levelName} message with context - {"custom":"data","scope":"${scopeName}"}`
          )
        );
      });

      test(`scoped ${fnName}() should respect global minLevel`, () => {
        configure({ minLevel: LOG_LEVELS.ERROR }); // Numeric level
        if (numericLevel < LOG_LEVELS.ERROR) {
          scopedLogger[fnName](`Scoped ${levelName} message`);
          expect(consoleSpies[consoleMethod]).not.toHaveBeenCalled();
        } else {
          // This will only be true for error level
          scopedLogger[fnName](`Scoped ${levelName} message`);
          expect(consoleSpies[consoleMethod]).toHaveBeenCalled();
        }
      });
    });

    test('scoped logger should handle context serialization errors gracefully', () => {
      const circularContext = {};
      circularContext.self = circularContext;

      scopedLogger.info('Scoped message with circular context', circularContext);
      // When context serialization fails, the scope is also lost in the output, as JSON.stringify on the merged object fails.
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `[INFO] Scoped message with circular context - [Context serialization error]`
        )
      );
      // No separate console.warn for serialization error as per logger.js implementation
    });
  });
});

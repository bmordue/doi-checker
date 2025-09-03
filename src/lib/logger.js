/**
 * Logger Utility
 * Provides consistent logging functionality for the DOI Checker application
 */

// Log levels in order of severity
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Default configuration
const defaultConfig = {
  minLevel: LOG_LEVELS.INFO,
  colorize: true,
  timestamps: true,
  includeContext: true,
};

// Singleton logger instance
let loggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 * @param {Object} config - Logger configuration
 * @param {number} config.minLevel - Minimum log level to output
 * @param {boolean} config.colorize - Whether to colorize log output
 * @param {boolean} config.timestamps - Whether to include timestamps
 * @param {boolean} config.includeContext - Whether to include context information
 */
export function configure(config = {}) {
  loggerConfig = { ...defaultConfig, ...config };
}

/**
 * Format a log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 * @returns {string} - Formatted log message
 */
function formatLogMessage(level, message, context = {}) {
  const parts = [];

  // Add timestamp if enabled
  if (loggerConfig.timestamps) {
    parts.push(`[${new Date().toISOString()}]`);
  }

  // Add log level
  parts.push(`[${level}]`);

  // Add message
  parts.push(message);

  // Add context if enabled and available
  if (loggerConfig.includeContext && Object.keys(context).length > 0) {
    try {
      const contextStr = JSON.stringify(context);
      parts.push(`- ${contextStr}`);
    } catch {
      parts.push('- [Context serialization error]');
    }
  }

  return parts.join(' ');
}

/**
 * Log a debug message
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
export function debug(message, context = {}) {
  if (loggerConfig.minLevel <= LOG_LEVELS.DEBUG) {
    console.debug(formatLogMessage('DEBUG', message, context));
  }
}

/**
 * Log an info message
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
export function info(message, context = {}) {
  if (loggerConfig.minLevel <= LOG_LEVELS.INFO) {
    console.info(formatLogMessage('INFO', message, context));
  }
}

/**
 * Log a warning message
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
export function warn(message, context = {}) {
  if (loggerConfig.minLevel <= LOG_LEVELS.WARN) {
    console.warn(formatLogMessage('WARN', message, context));
  }
}

/**
 * Log an error message
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
export function error(message, context = {}) {
  if (loggerConfig.minLevel <= LOG_LEVELS.ERROR) {
    console.error(formatLogMessage('ERROR', message, context));
  }
}

/**
 * Create a scoped logger with a specific context
 * @param {string} scope - Logger scope name
 * @returns {Object} - Scoped logger object
 */
export function createScopedLogger(scope) {
  return {
    debug: (message, context = {}) => debug(message, { ...context, scope }),
    info: (message, context = {}) => info(message, { ...context, scope }),
    warn: (message, context = {}) => warn(message, { ...context, scope }),
    error: (message, context = {}) => error(message, { ...context, scope }),
  };
}

// Default logger instance
export default {
  configure,
  debug,
  info,
  warn,
  error,
  createScopedLogger,
};

// Logger utility for consistent logging with different levels of verbosity

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

// Default to INFO level in development, can be changed at runtime
let currentLogLevel: LogLevel = LogLevel.INFO;

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Set the global log level
   * @param level The log level to set
   */
  static setLevel(level: LogLevel): void {
    currentLogLevel = level;
    Logger.info('Logger', `Log level set to ${LogLevel[level]}`);
  }

  /**
   * Get the current log level
   */
  static getLevel(): LogLevel {
    return currentLogLevel;
  }

  /**
   * Get a readable name for the current log level
   */
  static getLevelName(): string {
    return LogLevel[currentLogLevel];
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param data Optional data to include
   */
  error(message: string, data?: any): void {
    if (currentLogLevel >= LogLevel.ERROR) {
      console.error(`[ERROR] [${this.context}] ${message}`, data ? data : '');
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Optional data to include
   */
  warn(message: string, data?: any): void {
    if (currentLogLevel >= LogLevel.WARN) {
      console.warn(`[WARN] [${this.context}] ${message}`, data ? data : '');
    }
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Optional data to include
   */
  info(message: string, data?: any): void {
    if (currentLogLevel >= LogLevel.INFO) {
      console.info(`[INFO] [${this.context}] ${message}`, data ? data : '');
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Optional data to include
   */
  debug(message: string, data?: any): void {
    if (currentLogLevel >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] [${this.context}] ${message}`, data ? data : '');
    }
  }

  /**
   * Log a trace message
   * @param message The message to log
   * @param data Optional data to include
   */
  trace(message: string, data?: any): void {
    if (currentLogLevel >= LogLevel.TRACE) {
      console.log(`[TRACE] [${this.context}] ${message}`, data ? data : '');
    }
  }

  /**
   * Static version of error for convenience
   */
  static error(context: string, message: string, data?: any): void {
    new Logger(context).error(message, data);
  }

  /**
   * Static version of warn for convenience
   */
  static warn(context: string, message: string, data?: any): void {
    new Logger(context).warn(message, data);
  }

  /**
   * Static version of info for convenience
   */
  static info(context: string, message: string, data?: any): void {
    new Logger(context).info(message, data);
  }

  /**
   * Static version of debug for convenience
   */
  static debug(context: string, message: string, data?: any): void {
    new Logger(context).debug(message, data);
  }

  /**
   * Static version of trace for convenience
   */
  static trace(context: string, message: string, data?: any): void {
    new Logger(context).trace(message, data);
  }
} 
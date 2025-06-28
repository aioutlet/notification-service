class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  info(message: string, ...args: any[]): void {
    console.log(`[${this.getTimestamp()}] INFO: ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.getTimestamp()}] ERROR: ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.getTimestamp()}] WARN: ${message}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.getTimestamp()}] DEBUG: ${message}`, ...args);
  }
}

const logger = new Logger();
export default logger;

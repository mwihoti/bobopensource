import { logger } from '../utils/logger';

export class WebLogger {
  private logs: { message: string; type: string; timestamp: string }[] = [];
  private onLog?: (log: { message: string; type: string; timestamp: string }) => void;

  constructor(onLog?: (log: { message: string; type: string; timestamp: string }) => void) {
    this.onLog = onLog;
  }

  private addLog(message: string, type: string) {
    const log = {
      message,
      type,
      timestamp: new Date().toISOString(),
    };
    this.logs.push(log);
    if (this.onLog) {
      this.onLog(log);
    }
  }

  info(message: string) {
    this.addLog(message, 'info');
    logger.info(message);
  }

  success(message: string) {
    this.addLog(message, 'success');
    logger.success(message);
  }

  error(message: string) {
    this.addLog(message, 'error');
    logger.error(message);
  }

  warn(message: string) {
    this.addLog(message, 'warn');
    logger.warn(message);
  }

  progress(message: string) {
    this.addLog(message, 'progress');
    logger.progress(message);
  }

  getLogs() {
    return this.logs;
  }
}

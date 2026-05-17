import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SUCCESS = 4,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private verbose: boolean = false;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG && this.verbose) {
      console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(chalk.blue(`ℹ ${message}`), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.log(chalk.yellow(`⚠ ${message}`), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(chalk.red(`✗ ${message}`), ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.SUCCESS) {
      console.log(chalk.green(`✓ ${message}`), ...args);
    }
  }

  section(title: string): void {
    console.log('\n' + chalk.bold.cyan(`━━━ ${title} ━━━`) + '\n');
  }

  subsection(title: string): void {
    console.log(chalk.bold(`\n${title}:`));
  }

  list(items: string[], indent: number = 2): void {
    const prefix = ' '.repeat(indent);
    items.forEach(item => {
      console.log(`${prefix}• ${item}`);
    });
  }

  keyValue(key: string, value: string, indent: number = 2): void {
    const prefix = ' '.repeat(indent);
    console.log(`${prefix}${chalk.bold(key)}: ${value}`);
  }

  progress(message: string): void {
    console.log(chalk.cyan(`⏳ ${message}...`));
  }

  newline(): void {
    console.log();
  }
}

export const logger = new Logger();

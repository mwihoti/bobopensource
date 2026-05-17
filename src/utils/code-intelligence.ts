import * as path from 'path';

export interface StylePattern {
  indentUnit: string;
  quoteStyle: 'single' | 'double';
  semicolons: boolean;
  trailingComma: boolean;
}

export interface InsertionPoint {
  line: number;
  confidence: number;
  anchor: string;
  reason: string;
}

export interface ConflictReport {
  hasConflicts: boolean;
  conflicts: string[];
}

export class CodeIntelligence {
  static analyzeStyle(content: string): StylePattern {
    const lines = content.split('\n');
    const indents = lines
      .filter(line => /^\s+\S/.test(line))
      .map(line => line.match(/^(\s+)/)?.[1] || '')
      .filter(Boolean);

    const spaceIndents = indents.filter(indent => indent.includes(' '));
    const tabIndents = indents.filter(indent => indent.includes('\t'));
    const indentUnit = tabIndents.length > spaceIndents.length
      ? '\t'
      : this.detectSpaceIndent(spaceIndents);

    const singleQuotes = (content.match(/'[^'\n]*'/g) || []).length;
    const doubleQuotes = (content.match(/"[^"\n]*"/g) || []).length;
    const semicolonLines = lines.filter(line => line.trim().endsWith(';')).length;
    const statementLines = lines.filter(line => /(?:return|const|let|var|throw|await|\)\s*)$/.test(line.trim()) || /=/.test(line)).length;
    const trailingComma = /,\s*[\]}]/.test(content);

    return {
      indentUnit,
      quoteStyle: singleQuotes >= doubleQuotes ? 'single' : 'double',
      semicolons: semicolonLines >= Math.max(1, Math.floor(statementLines * 0.4)),
      trailingComma,
    };
  }

  static detectInsertionPoint(filePath: string, content: string, snippet: string): InsertionPoint {
    const lines = content.split('\n');
    const lowerPath = filePath.toLowerCase();

    if (/\.(test|spec)\./.test(lowerPath) || lowerPath.includes('/tests/')) {
      return {
        line: lines.length + 1,
        confidence: 0.86,
        anchor: 'end_of_test_file',
        reason: 'Appending a new focused test below existing tests is the safest default insertion strategy.',
      };
    }

    const importIndexes = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /^\s*(import\s|const\s+\w+\s*=\s*require\()/.test(line));

    if (/^\s*import\s/m.test(snippet) && importIndexes.length > 0) {
      const lastImport = importIndexes[importIndexes.length - 1];
      return {
        line: lastImport.index + 2,
        confidence: 0.95,
        anchor: 'after_imports',
        reason: 'New imports belong directly after the existing import block.',
      };
    }

    const rustMainIndex = lines.findIndex(line => /^\s*fn\s+main\s*\(/.test(line));
    if (lowerPath.endsWith('.rs') && rustMainIndex >= 0) {
      return {
        line: rustMainIndex,
        confidence: 0.72,
        anchor: 'before_main',
        reason: 'Helper logic in Rust files is commonly placed before fn main.',
      };
    }

    const exportIndex = lines.findIndex(line => /^\s*export\s+(default\s+)?(async\s+)?function\s+\w+/.test(line));
    if (exportIndex >= 0) {
      return {
        line: exportIndex + 1,
        confidence: 0.68,
        anchor: 'before_first_export',
        reason: 'Placing helper code before the first exported function keeps the public API block intact.',
      };
    }

    return {
      line: lines.length + 1,
      confidence: 0.6,
      anchor: 'end_of_file',
      reason: 'No stronger structural anchor was detected, so append-at-end is the fallback.',
    };
  }

  static detectConflicts(content: string, snippet: string): ConflictReport {
    const existingSymbols = new Set<string>();
    const snippetSymbols = new Set<string>();

    for (const source of [content, snippet]) {
      const target = source === content ? existingSymbols : snippetSymbols;
      this.collectSymbols(source, target);
    }

    const conflicts = Array.from(snippetSymbols).filter(symbol => existingSymbols.has(symbol));

    return {
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts.map(symbol => `Existing symbol conflict detected: ${symbol}`),
    };
  }

  static adaptCodeStyle(snippet: string, style: StylePattern, filePath: string): string {
    let adapted = snippet.replace(/\t/g, style.indentUnit);

    if (style.quoteStyle === 'single' && /\.(ts|tsx|js|jsx)$/.test(filePath)) {
      adapted = adapted.replace(/"([^"\n]*)"/g, (_match, value) => `'${value.replace(/'/g, "\\'")}'`);
    } else if (style.quoteStyle === 'double' && /\.(ts|tsx|js|jsx)$/.test(filePath)) {
      adapted = adapted.replace(/'([^'\n]*)'/g, (_match, value) => `"${value.replace(/"/g, '\\"')}"`);
    }

    if (style.semicolons && /\.(ts|tsx|js|jsx)$/.test(filePath)) {
      adapted = adapted
        .split('\n')
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed || /[;{}:,]$/.test(trimmed) || trimmed.startsWith('//')) {
            return line;
          }
          if (/^(if|for|while|switch|function|class|interface|type)\b/.test(trimmed)) {
            return line;
          }
          return `${line};`;
        })
        .join('\n');
    }

    return adapted;
  }

  static generateUnifiedDiff(
    originalContent: string,
    filePath: string,
    insertionPoint: InsertionPoint,
    adaptedSnippet: string,
    contextLines: number = 3
  ): string {
    const lines = originalContent.split('\n');
    const insertIndex = Math.max(0, Math.min(lines.length, insertionPoint.line - 1));
    const before = lines.slice(Math.max(0, insertIndex - contextLines), insertIndex);
    const after = lines.slice(insertIndex, Math.min(lines.length, insertIndex + contextLines));
    const snippetLines = adaptedSnippet.split('\n');
    const startLine = Math.max(1, insertIndex - before.length + 1);

    const diffLines: string[] = [];
    diffLines.push(`--- a/${filePath}`);
    diffLines.push(`+++ b/${filePath}`);
    diffLines.push(`@@ -${startLine},${before.length + after.length} +${startLine},${before.length + snippetLines.length + after.length} @@`);
    before.forEach(line => diffLines.push(` ${line}`));
    snippetLines.forEach(line => diffLines.push(`+${line}`));
    after.forEach(line => diffLines.push(` ${line}`));

    return diffLines.join('\n');
  }

  private static collectSymbols(source: string, target: Set<string>): void {
    const patterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      /(?:export\s+)?class\s+(\w+)/g,
      /(?:export\s+)?(?:interface|type|enum)\s+(\w+)/g,
      /(?:const|let|var)\s+(\w+)\s*=/g,
      /use\s+(\w+)\s+as/gi,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        target.add(match[1]);
      }
    }
  }

  private static detectSpaceIndent(indents: string[]): string {
    const lengths = indents
      .map(indent => indent.replace(/\t/g, '').length)
      .filter(length => length > 0)
      .sort((a, b) => a - b);

    if (lengths.length === 0) {
      return '  ';
    }

    const smallest = lengths[0];
    return ' '.repeat(Math.max(2, Math.min(4, smallest)));
  }
}

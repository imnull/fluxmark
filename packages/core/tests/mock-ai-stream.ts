/**
 * AI 流式响应模拟工具
 * 用于测试流式 Markdown 解析器的各种边界情况
 */

import { StreamingParser } from '../src/parser.js';
import type { Fragment } from '../src/types/index.js';

export interface StreamOptions {
  /** 每个 chunk 之间的延迟（毫秒） */
  chunkDelay?: number;
  /** 是否随机化延迟 */
  randomizeDelay?: boolean;
  /** 每个 chunk 的最大字符数 */
  maxChunkSize?: number;
  /** 是否模拟网络抖动（随机分割点） */
  simulateJitter?: boolean;
  /** 回调函数：每个 chunk 到达时 */
  onChunk?: (chunk: string, index: number) => void;
  /** 回调函数：所有 chunk 完成后 */
  onComplete?: (fragments: Fragment[]) => void;
}

/**
 * 模拟 AI 流式输出
 * 
 * @param markdown 完整的 Markdown 内容
 * @param parser StreamingParser 实例
 * @param options 流式选项
 * @returns Promise<Fragment[]>
 * 
 * @example
 * ```typescript
 * const parser = new StreamingParser();
 * const fragments = await simulateAIStream(
 *   "# Title\n\nHello world",
 *   parser,
 *   { chunkDelay: 100, simulateJitter: true }
 * );
 * ```
 */
export function simulateAIStream(
  markdown: string,
  parser: StreamingParser,
  options: StreamOptions = {}
): Promise<Fragment[]> {
  const {
    chunkDelay = 50,
    randomizeDelay = false,
    maxChunkSize = 10,
    simulateJitter = true,
    onChunk,
    onComplete,
  } = options;

  return new Promise((resolve) => {
    const chunks = simulateJitter
      ? splitWithJitter(markdown, maxChunkSize)
      : splitBySize(markdown, maxChunkSize);

    let index = 0;

    function sendNextChunk() {
      if (index >= chunks.length) {
        // 所有 chunk 发送完成
        const fragments = parser.finalize();
        onComplete?.(fragments);
        resolve(fragments);
        return;
      }

      const chunk = chunks[index];
      parser.appendChunk(chunk);
      onChunk?.(chunk, index);

      index++;

      // 计算延迟
      const delay = randomizeDelay
        ? chunkDelay * (0.5 + Math.random())
        : chunkDelay;

      setTimeout(sendNextChunk, delay);
    }

    // 开始发送
    sendNextChunk();
  });
}

/**
 * 模拟真实网络抖动：随机位置分割
 */
function splitWithJitter(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    // 随机 chunk 大小，但不超过 maxSize
    const size = Math.max(1, Math.floor(Math.random() * maxSize) + 1);
    chunks.push(text.slice(pos, pos + size));
    pos += size;
  }

  return chunks;
}

/**
 * 固定大小分割
 */
function splitBySize(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

/**
 * 模拟特定场景的流式输出
 */
export const StreamScenarios = {
  /**
   * 标题跨 chunk："# Hel" + "lo\n"
   */
  headingAcrossChunks: (parser: StreamingParser, options?: StreamOptions) => {
    const chunks = ['# Hel', 'lo\n', '\n', 'Para\n', '\n'];
    return simulateWithChunks(chunks, parser, options);
  },

  /**
   * 代码块跨 chunk，包含空行
   */
  codeBlockWithEmptyLine: (parser: StreamingParser, options?: StreamOptions) => {
    const markdown = '```js\nline1\n\nline2\n```\n';
    return simulateAIStream(markdown, parser, {
      maxChunkSize: 5,
      simulateJitter: true,
      ...options,
    });
  },

  /**
   * 图片在段落中间
   */
  imageInParagraph: (parser: StreamingParser, options?: StreamOptions) => {
    const markdown = 'Text ![img](url.jpg) more\n\n';
    return simulateAIStream(markdown, parser, {
      maxChunkSize: 8,
      ...options,
    });
  },

  /**
   * 混合内容流式输出
   */
  mixedContent: (parser: StreamingParser, options?: StreamOptions) => {
    const markdown = `# Title

Paragraph 1 with **bold**.

\`\`\`typescript
const x = 1;
console.log(x);
\`\`\`

- Item 1
- Item 2

![image](https://example.com/img.png)

> Quote block
`;
    return simulateAIStream(markdown, parser, {
      maxChunkSize: 10,
      simulateJitter: true,
      ...options,
    });
  },

  /**
   * 边界情况：代码块以换行开头
   */
  codeBlockStartsWithNewline: (parser: StreamingParser, options?: StreamOptions) => {
    // 模拟：先发 "```js\nline1"，然后在下一个 chunk 以 "\n" 开头
    const chunks = ['```js\nline1', '\n\nline2\n```\n'];
    return simulateWithChunks(chunks, parser, options);
  },

  /**
   * 边界情况：行号计算
   */
  lineNumberCalculation: (parser: StreamingParser, options?: StreamOptions) => {
    const chunks = ['# Title\n', '\n', 'Paragraph\n'];
    return simulateWithChunks(chunks, parser, options);
  },
};

/**
 * 使用预定义 chunks 进行模拟
 */
function simulateWithChunks(
  chunks: string[],
  parser: StreamingParser,
  options: StreamOptions = {}
): Promise<Fragment[]> {
  const {
    chunkDelay = 50,
    onChunk,
    onComplete,
  } = options;

  return new Promise((resolve) => {
    let index = 0;

    function sendNextChunk() {
      if (index >= chunks.length) {
        const fragments = parser.finalize();
        onComplete?.(fragments);
        resolve(fragments);
        return;
      }

      const chunk = chunks[index];
      parser.appendChunk(chunk);
      onChunk?.(chunk, index);

      index++;
      setTimeout(sendNextChunk, chunkDelay);
    }

    sendNextChunk();
  });
}

/**
 * 调试工具：打印流式解析过程
 */
export async function debugStream(
  markdown: string,
  parser: StreamingParser,
  options: StreamOptions = {}
): Promise<void> {
  console.log('=== Debug Stream ===');
  console.log('Input:', JSON.stringify(markdown));
  console.log('');

  const fragments = await simulateAIStream(markdown, parser, {
    ...options,
    onChunk: (chunk, index) => {
      console.log(`Chunk ${index}: ${JSON.stringify(chunk)}`);
      const currentFragments = parser.getFragments();
      console.log(`  Fragments: ${currentFragments.length}`);
      currentFragments.forEach((f, i) => {
        console.log(`    [${i}] ${f.type}: ${f.isComplete ? '✓' : '○'} key=${f.key.slice(0, 20)}...`);
      });
      console.log('');
    },
  });

  console.log('=== Final Fragments ===');
  fragments.forEach((f, i) => {
    console.log(`[${i}] ${f.type} (${f.isComplete ? 'complete' : 'incomplete'})`);
    console.log(`    key: ${f.key}`);
    console.log(`    raw: ${JSON.stringify(f.rawContent.slice(0, 50))}`);
    console.log(`    pos: L${f.position.line}:C${f.position.column}`);
    console.log('');
  });
}

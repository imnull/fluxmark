# 实现指南

## 第一阶段：核心 Parser 实现

### 1.1 项目初始化

```bash
mkdir streaming-markdown-core
cd streaming-markdown-core
npm init -y
npm install -D typescript vitest @types/node
npx tsc --init
```

tsconfig.json 配置：
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### 1.2 Hash 工具实现

创建 `src/utils/hash.ts`：

```typescript
/**
 * MurmurHash3 算法实现
 * 快速、分布均匀的字符串 hash
 */
export function murmurHash3(str: string, seed: number = 0): string {
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  const r1 = 15;
  const r2 = 13;
  const m = 5;
  const n = 0xe6546b64;

  let i = 0;
  const len = str.length;

  while (i + 4 <= len) {
    let k1 = (
      (str.charCodeAt(i) & 0xff) |
      ((str.charCodeAt(i + 1) & 0xff) << 8) |
      ((str.charCodeAt(i + 2) & 0xff) << 16) |
      ((str.charCodeAt(i + 3) & 0xff) << 24)
    );

    k1 = Math.imul(k1, c1);
    k1 = (k1 << r1) | (k1 >>> (32 - r1));
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << r2) | (h1 >>> (32 - r2));
    h1 = Math.imul(h1, m) + n;

    i += 4;
  }

  let k1 = 0;
  switch (len & 3) {
    case 3: k1 ^= (str.charCodeAt(i + 2) & 0xff) << 16;
    case 2: k1 ^= (str.charCodeAt(i + 1) & 0xff) << 8;
    case 1: k1 ^= (str.charCodeAt(i) & 0xff);
      k1 = Math.imul(k1, c1);
      k1 = (k1 << r1) | (k1 >>> (32 - r1));
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return (h1 >>> 0).toString(16).padStart(8, '0');
}

/** 简单快速 hash */
export function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
```

### 1.3 类型定义

创建 `src/types.ts`：

```typescript
export type FragmentType = 
  | 'heading'
  | 'paragraph'
  | 'codeblock'
  | 'list'
  | 'listItem'
  | 'blockquote'
  | 'image'
  | 'thematicBreak'
  | 'html'
  | 'table'
  | 'incomplete';

export interface Position {
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface FragmentMeta {
  createdAt: number;
  updatedAt: number;
  updateCount: number;
  fromStreaming: boolean;
}

export interface Fragment {
  key: string;
  type: FragmentType;
  rawContent: string;
  isComplete: boolean;
  position: Position;
  children?: Fragment[];
  meta: FragmentMeta;
  data: unknown;
}

export interface ParserOptions {
  highlightCode?: boolean;
  incompleteCodeStrategy?: 'line' | 'char' | 'none';
  hashAlgorithm?: 'murmur3' | 'djb2';
}
```

### 1.4 核心 Parser 实现

创建 `src/parser.ts`：

```typescript
import { murmurHash3, djb2 } from './utils/hash';
import type { Fragment, FragmentType, ParserOptions, Position } from './types';

interface BlockPattern {
  type: FragmentType;
  startPattern: RegExp;
  endPattern?: RegExp;
  isSingleLine?: boolean;
}

const BLOCK_PATTERNS: BlockPattern[] = [
  { type: 'codeblock', startPattern: /^```(\w*)/, endPattern: /^```$/ },
  { type: 'heading', startPattern: /^(#{1,6})\s/, isSingleLine: true },
  { type: 'list', startPattern: /^([\s]*)([-*+]|\d+\.)\s/ },
  { type: 'blockquote', startPattern: /^>\s*/ },
  { type: 'thematicBreak', startPattern: /^(-{3,}|\*{3,}|_{3,})$/, isSingleLine: true },
];

const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g;

export class StreamingParser {
  private buffer: string = '';
  private fragments: Fragment[] = [];
  private currentFragment: Fragment | null = null;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private options: Required<ParserOptions>;

  constructor(options: ParserOptions = {}) {
    this.options = {
      highlightCode: false,
      incompleteCodeStrategy: 'line',
      hashAlgorithm: 'murmur3',
      ...options,
    };
  }

  appendChunk(chunk: string): void {
    this.buffer += chunk;
    this.parseIncremental();
  }

  private parseIncremental(): void {
    const lines = this.buffer.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const isLastLine = i === lines.length - 1;
      const line = lines[i];
      
      if (this.currentFragment) {
        this.continueFragment(line, isLastLine);
      } else {
        this.startNewFragment(line, isLastLine);
      }
    }
  }

  private startNewFragment(line: string, isLastLine: boolean): void {
    // 空行跳过
    if (!line.trim()) {
      this.updatePosition(line + (isLastLine ? '' : '\n'));
      return;
    }

    // 检测块级元素
    const pattern = BLOCK_PATTERNS.find(p => p.startPattern.test(line));
    
    if (pattern) {
      if (pattern.isSingleLine) {
        this.createCompleteFragment(pattern.type, line);
      } else if (pattern.type === 'codeblock') {
        this.startCodeBlock(line, isLastLine);
      } else {
        this.startBlockFragment(pattern.type, line, isLastLine);
      }
    } else {
      // 默认作为段落
      this.startBlockFragment('paragraph', line, isLastLine);
    }
  }

  private startCodeBlock(line: string, isLastLine: boolean): void {
    const match = line.match(/^```(\w*)/);
    const lang = match?.[1] || '';
    
    this.currentFragment = this.createFragment({
      type: 'codeblock',
      rawContent: line + '\n',
      isComplete: false,
      data: { lang, code: '', lines: [] },
    });

    this.updatePosition(line + '\n');
  }

  private continueFragment(line: string, isLastLine: boolean): void {
    if (!this.currentFragment) return;

    const type = this.currentFragment.type;

    if (type === 'codeblock') {
      this.continueCodeBlock(line, isLastLine);
    } else {
      this.continueBlockFragment(line, isLastLine);
    }
  }

  private continueCodeBlock(line: string, isLastLine: boolean): void {
    const endMatch = line.match(/^```$/);
    
    if (endMatch && !isLastLine) {
      // 代码块结束
      this.currentFragment!.rawContent += line;
      this.currentFragment!.isComplete = true;
      this.currentFragment!.position.end = this.position;
      this.finalizeFragment();
    } else {
      // 继续累积代码
      this.currentFragment!.rawContent += line + (isLastLine ? '' : '\n');
      
      // 更新代码行数据
      const codeData = this.currentFragment!.data as { lang: string; code: string; lines: { content: string; lineNumber: number; isComplete: boolean }[] };
      codeData.code += line + '\n';
      
      // 按行分片策略
      if (this.options.incompleteCodeStrategy === 'line') {
        const lineNumber = codeData.lines.length + 1;
        codeData.lines.push({
          content: line,
          lineNumber,
          isComplete: !isLastLine,
        });
      }

      if (!isLastLine) {
        this.updatePosition(line + '\n');
      } else {
        this.updatePosition(line);
      }
    }
  }

  private continueBlockFragment(line: string, isLastLine: boolean): void {
    // 空行表示块结束
    if (!line.trim() && !isLastLine) {
      this.currentFragment!.isComplete = true;
      this.currentFragment!.position.end = this.position;
      this.finalizeFragment();
      this.updatePosition(line + '\n');
      return;
    }

    this.currentFragment!.rawContent += '\n' + line;
    
    if (!isLastLine) {
      this.updatePosition('\n' + line);
    }
  }

  private createCompleteFragment(type: FragmentType, content: string): void {
    const fragment = this.createFragment({
      type,
      rawContent: content,
      isComplete: true,
      data: this.parseBlockData(type, content),
    });
    
    this.fragments.push(fragment);
    this.updatePosition(content + '\n');
  }

  private startBlockFragment(type: FragmentType, line: string, isLastLine: boolean): void {
    this.currentFragment = this.createFragment({
      type,
      rawContent: line,
      isComplete: false,
      data: { content: line },
    });

    this.updatePosition(line);
  }

  private finalizeFragment(): void {
    if (!this.currentFragment) return;
    
    // 处理图片分片
    if (this.currentFragment.type === 'paragraph' || this.currentFragment.type === 'blockquote') {
      this.splitImages(this.currentFragment);
    }

    this.fragments.push(this.currentFragment);
    this.currentFragment = null;
  }

  private splitImages(fragment: Fragment): void {
    const content = fragment.rawContent;
    const parts: { type: 'text' | 'image'; content: string; data?: unknown }[] = [];
    
    let lastIndex = 0;
    let match;

    IMAGE_PATTERN.lastIndex = 0;
    while ((match = IMAGE_PATTERN.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
        });
      }
      
      parts.push({
        type: 'image',
        content: match[0],
        data: {
          alt: match[1],
          src: match[2],
          title: match[3],
        },
      });
      
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) });
    }

    // 如果只有一部分，不拆分
    if (parts.length <= 1) return;

    // 创建多个分片替代原分片
    const basePosition = fragment.position;
    let currentPos = basePosition.start;

    this.fragments.push(...parts.map((part, index) => {
      const frag = this.createFragment({
        type: part.type === 'image' ? 'image' : fragment.type,
        rawContent: part.content,
        isComplete: fragment.isComplete,
        position: {
          start: currentPos,
          end: currentPos + part.content.length,
          line: basePosition.line,
          column: basePosition.column,
        },
        data: part.data || { content: part.content },
      });
      currentPos += part.content.length;
      return frag;
    }));
  }

  private createFragment(partial: Omit<Fragment, 'key' | 'meta'> & { position?: Position }): Fragment {
    const now = Date.now();
    const rawContent = partial.rawContent;
    
    const hashFn = this.options.hashAlgorithm === 'murmur3' ? murmurHash3 : djb2;
    const key = partial.isComplete 
      ? `frag-${hashFn(rawContent)}`
      : `temp-${this.fragments.length}-${rawContent.length}-${now}`;

    return {
      ...partial,
      key,
      position: partial.position || {
        start: this.position,
        end: this.position + rawContent.length,
        line: this.line,
        column: this.column,
      },
      meta: {
        createdAt: now,
        updatedAt: now,
        updateCount: 0,
        fromStreaming: true,
      },
    } as Fragment;
  }

  private parseBlockData(type: FragmentType, content: string): unknown {
    switch (type) {
      case 'heading': {
        const match = content.match(/^(#{1,6})\s+(.*)$/);
        return {
          level: match?.[1].length || 1,
          content: match?.[2] || content,
        };
      }
      case 'codeblock':
        return { lang: '', code: '' };
      default:
        return { content };
    }
  }

  private updatePosition(text: string): void {
    for (const char of text) {
      this.position++;
      if (char === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
    }
  }

  getFragments(): Fragment[] {
    return [...this.fragments, ...(this.currentFragment ? [this.currentFragment] : [])];
  }

  reset(): void {
    this.buffer = '';
    this.fragments = [];
    this.currentFragment = null;
    this.position = 0;
    this.line = 1;
    this.column = 1;
  }

  finalize(): Fragment[] {
    if (this.currentFragment) {
      this.currentFragment.isComplete = true;
      this.finalizeFragment();
    }
    return this.fragments;
  }
}
```

### 1.5 测试

创建 `src/parser.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { StreamingParser } from './parser';

describe('StreamingParser', () => {
  let parser: StreamingParser;

  beforeEach(() => {
    parser = new StreamingParser();
  });

  it('should parse heading', () => {
    parser.appendChunk('# Hello World\n');
    const fragments = parser.getFragments();
    
    expect(fragments).toHaveLength(1);
    expect(fragments[0].type).toBe('heading');
    expect(fragments[0].isComplete).toBe(true);
    expect(fragments[0].key).toMatch(/^frag-/);
  });

  it('should parse paragraph incrementally', () => {
    parser.appendChunk('This is a ');
    const frag1 = parser.getFragments();
    expect(frag1).toHaveLength(1);
    expect(frag1[0].isComplete).toBe(false);
    expect(frag1[0].key).toMatch(/^temp-/);

    parser.appendChunk('paragraph.\n\n');
    const frag2 = parser.getFragments();
    expect(frag2[0].isComplete).toBe(true);
    expect(frag2[0].key).toMatch(/^frag-/);
  });

  it('should split images into separate fragments', () => {
    parser.appendChunk('Text ![alt](url.jpg) more text\n\n');
    const fragments = parser.finalize();
    
    expect(fragments.length).toBeGreaterThanOrEqual(2);
    expect(fragments.some(f => f.type === 'image')).toBe(true);
  });

  it('should generate stable keys for same content', () => {
    parser.appendChunk('# Same\n');
    const key1 = parser.getFragments()[0].key;
    
    parser.reset();
    parser.appendChunk('# Same\n');
    const key2 = parser.getFragments()[0].key;
    
    expect(key1).toBe(key2);
  });
});
```

运行测试：
```bash
npx vitest
```

## 第二阶段：React 组件实现

### 2.1 项目设置

```bash
mkdir streaming-markdown-react
cd streaming-markdown-react
npm init -y
npm install react react-dom
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react
```

### 2.2 React Hook

创建 `src/useStreamingParser.ts`：

```typescript
import { useState, useEffect, useRef, useMemo } from 'react';
import { StreamingParser } from '../core/parser';
import type { Fragment, ParserOptions } from '../core/types';

export function useStreamingParser(content: string, options?: ParserOptions) {
  const parserRef = useRef<StreamingParser | null>(null);
  const lastContentRef = useRef<string>('');
  const [fragments, setFragments] = useState<Fragment[]>([]);

  const parser = useMemo(() => {
    if (!parserRef.current) {
      parserRef.current = new StreamingParser(options);
    }
    return parserRef.current;
  }, []);

  useEffect(() => {
    // 计算增量
    const newChunk = content.slice(lastContentRef.current.length);
    
    if (newChunk) {
      parser.appendChunk(newChunk);
      setFragments(parser.getFragments());
      lastContentRef.current = content;
    }
  }, [content, parser]);

  const isComplete = useMemo(() => {
    return fragments.every(f => f.isComplete);
  }, [fragments]);

  return { fragments, isComplete, parser };
}
```

### 2.3 组件实现

创建 `src/components/StreamingMarkdown.tsx`：

```tsx
import React, { memo } from 'react';
import { useStreamingParser } from '../hooks/useStreamingParser';
import type { Fragment, ParserOptions } from '../core/types';
import './StreamingMarkdown.css';

// 子组件
const HeadingRenderer = memo(({ fragment }: { fragment: Fragment }) => {
  const data = fragment.data as { level: number; content: string };
  const Tag = `h${data.level}` as keyof JSX.IntrinsicElements;
  return <Tag className="md-heading">{data.content}</Tag>;
});

const ParagraphRenderer = memo(({ fragment }: { fragment: Fragment }) => {
  const data = fragment.data as { content: string };
  return <p className="md-paragraph">{data.content}</p>;
});

const CodeBlockRenderer = memo(({ fragment }: { fragment: Fragment }) => {
  const data = fragment.data as { lang: string; code: string; lines?: { content: string; isComplete: boolean }[] };
  
  return (
    <pre className="md-codeblock">
      <code className={`language-${data.lang}`}>
        {data.lines ? (
          data.lines.map((line, i) => (
            <div 
              key={i} 
              className={`code-line ${line.isComplete ? 'complete' : 'incomplete'}`}
            >
              {line.content}
            </div>
          ))
        ) : (
          data.code
        )}
      </code>
    </pre>
  );
});

const ImageRenderer = memo(({ fragment }: { fragment: Fragment }) => {
  const data = fragment.data as { alt: string; src: string; title?: string };
  
  return (
    <img 
      src={data.src} 
      alt={data.alt} 
      title={data.title}
      className="md-image"
      loading="lazy"
    />
  );
});

const FragmentRenderer = memo(({ fragment }: { fragment: Fragment }) => {
  switch (fragment.type) {
    case 'heading':
      return <HeadingRenderer fragment={fragment} />;
    case 'paragraph':
      return <ParagraphRenderer fragment={fragment} />;
    case 'codeblock':
      return <CodeBlockRenderer fragment={fragment} />;
    case 'image':
      return <ImageRenderer fragment={fragment} />;
    default:
      return <div className="md-unknown">{fragment.rawContent}</div>;
  }
}, (prev, next) => {
  // 如果 key 相同，不重新渲染
  return prev.fragment.key === next.fragment.key;
});

// 主组件
interface StreamingMarkdownProps {
  content: string;
  options?: ParserOptions;
  className?: string;
}

export function StreamingMarkdown({ content, options, className }: StreamingMarkdownProps) {
  const { fragments } = useStreamingParser(content, options);

  return (
    <div className={`streaming-markdown ${className || ''}`}>
      {fragments.map((fragment) => (
        <FragmentRenderer 
          key={fragment.key} 
          fragment={fragment} 
        />
      ))}
    </div>
  );
}
```

### 2.4 CSS 样式

创建 `src/components/StreamingMarkdown.css`：

```css
.streaming-markdown {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}

.md-heading {
  margin: 1.5em 0 0.5em;
  font-weight: 600;
}

.md-paragraph {
  margin: 0.75em 0;
}

.md-codeblock {
  background: #f6f8fa;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 1em 0;
}

.md-codeblock code {
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-size: 85%;
  line-height: 1.45;
}

.code-line {
  min-height: 1.45em;
}

.code-line.incomplete {
  background: rgba(255, 255, 0, 0.1);
}

.md-image {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em 0;
}
```

### 2.5 使用示例

创建 `example/App.tsx`：

```tsx
import { useState, useEffect } from 'react';
import { StreamingMarkdown } from '../src/components/StreamingMarkdown';

// 模拟流式数据
const STREAM_DATA = [
  '# AI 对话示例\n\n',
  '这是一个 **流式渲染** 的示例。',
  '\n\n```typescript\n',
  'function hello() {\n',
  '  console.log("Hello World");\n',
  '}\n',
  '```\n\n',
  '下面是一张图片：\n\n',
  '![示例图片](https://example.com/image.jpg)\n\n',
  '文本继续...',
];

function App() {
  const [content, setContent] = useState('');

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < STREAM_DATA.length) {
        setContent(prev => prev + STREAM_DATA[index]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <h1>Streaming Markdown Renderer Demo</h1>
      <StreamingMarkdown 
        content={content}
        options={{ incompleteCodeStrategy: 'line' }}
      />
    </div>
  );
}

export default App;
```

## 第三阶段：验证与优化

### 3.1 闪烁测试

创建测试用例验证图片不会闪烁：

```typescript
// 使用 React Testing Library
import { render } from '@testing-library/react';
import { StreamingMarkdown } from './StreamingMarkdown';

it('should not re-render completed fragments', () => {
  const { container, rerender } = render(
    <StreamingMarkdown content="# Title\n\nPara 1" />
  );
  
  const heading = container.querySelector('h1');
  const headingRenderCount = (heading as any)._renderCount || 0;
  
  // 追加内容
  rerender(<StreamingMarkdown content="# Title\n\nPara 1\n\nPara 2" />);
  
  // 标题不应重新渲染
  expect((container.querySelector('h1') as any)._renderCount)
    .toBe(headingRenderCount);
});
```

### 3.2 性能监控

添加性能指标收集：

```typescript
// src/utils/performance.ts
export function measureRenderTime<T>(fn: () => T, label: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`[${label}] Render time: ${(end - start).toFixed(2)}ms`);
  return result;
}
```

完成以上步骤后，你就拥有了一个功能完整的流式 Markdown 渲染组件！

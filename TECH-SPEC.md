# 流式 Markdown 渲染组件 - 技术方案文档

**版本**: v1.0  
**日期**: 2026-02-14  
**状态**: ✅ 已确认

---

## 1. 技术架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Chat App    │  │  AI Playground│  │  Doc Editor  │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │ React Props
┌───────────────────────────▼─────────────────────────────────────┐
│                      React Integration                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              StreamingMarkdown Component                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │   Heading    │  │    Code      │  │    Image     │   │  │
│  │  │   Renderer   │  │   Renderer   │  │   Renderer   │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼──────────────────────────────┐  │
│  │              useStreamingParser Hook                      │  │
│  └───────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │ Fragments[]
┌──────────────────────────────▼──────────────────────────────────┐
│                      Core Parser (TypeScript)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Scanner    │──▶   Parser     │──▶  Fragment    │          │
│  │  (Tokenizer) │  │  (Generator) │  │   Factory    │          │
│  └──────────────┘  └──────────────┘  └──────┬───────┘          │
│                                              │                   │
│  ┌───────────────────────────────────────────▼──────────────┐  │
│  │                    Hash Generator                         │  │
│  │              (MurmurHash3 / FNV-1a)                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                    (Future: Rust/WASM Core)
```

### 1.2 模块职责

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| Scanner | 词法分析，识别块级边界 | Raw Markdown | Token Stream |
| Parser | 语法分析，构建 Fragment | Token Stream | Fragment Tree |
| Hash Generator | 生成内容哈希 | Fragment Content | Stable Key |
| Fragment Factory | 创建/更新分片对象 | Parsed Data | Fragment |
| React Hook | 桥接 Parser 与 React | Stream Content | Fragments State |
| Renderers | 渲染各类型分片 | Fragment | React Element |

---

## 2. 数据结构设计

### 2.1 Fragment（核心数据结构）

```typescript
interface Fragment {
  // 唯一标识符 - 核心机制
  key: string;                    // "frag-a1b2c3d4" 或 "temp-0-123-1707825600000"
  
  // 基础信息
  type: FragmentType;             // 'heading' | 'paragraph' | 'codeblock' | ...
  rawContent: string;             // 原始 Markdown 文本
  
  // 状态
  isComplete: boolean;            // 是否已完整解析
  
  // 位置信息（用于调试和映射）
  position: SourcePosition;       // 在原始文本中的位置
  
  // 结构化数据（类型相关）
  data: FragmentData;             // 类型特定的解析数据
  
  // 嵌套结构
  children?: Fragment[];          // 子分片（如列表项、代码行）
  
  // 元数据
  meta: FragmentMeta;             // 创建/更新时间、更新次数等
}

// 位置信息
interface SourcePosition {
  start: number;                  // 起始字符索引
  end: number;                    // 结束字符索引
  line: number;                   // 起始行号（1-based）
  column: number;                 // 起始列号（1-based）
}

// 元数据
interface FragmentMeta {
  createdAt: number;              // 创建时间戳
  updatedAt: number;              // 最后更新时间
  updateCount: number;            // 更新次数（调试用）
  fromStreaming: boolean;         // 是否来自流式解析
}
```

### 2.2 Fragment 类型定义

```typescript
type FragmentType = 
  | 'heading'           // # Title
  | 'paragraph'         // Normal text
  | 'codeblock'         // ```code```
  | 'list'              // - item / 1. item
  | 'listItem'          // List item
  | 'blockquote'        // > quote
  | 'image'             // ![alt](url)
  | 'thematicBreak'     // ---
  | 'html'              // <div>...</div>
  | 'table'             // | a | b |
  | 'incomplete';       // 未完成/暂态分片

// Union 类型：各类型对应的数据
type FragmentData = 
  | HeadingData
  | ParagraphData  
  | CodeBlockData
  | ListData
  | ImageData
  | IncompleteData;

// Heading
interface HeadingData {
  level: number;                  // 1-6
  content: string;                // 纯文本内容
}

// Paragraph
interface ParagraphData {
  content: string;                // 文本内容
  inlineElements: InlineElement[]; // 行内元素（加粗、链接等）
}

// Code Block
interface CodeBlockData {
  lang: string;                   // 语言标识
  code: string;                   // 完整代码
  lines: CodeLine[];              // 分行数据（细粒度分片）
  highlighted?: string;           // 高亮后的 HTML（缓存）
}

interface CodeLine {
  content: string;                // 行内容
  lineNumber: number;             // 行号
  isComplete: boolean;            // 该行是否完成（最后一行可能未完成）
  highlighted?: string;           // 高亮缓存
}

// List
interface ListData {
  ordered: boolean;               // 是否有序列表
  start: number;                  // 起始编号
  items: ListItem[];              // 列表项
}

interface ListItem {
  content: string;
  checked?: boolean;              // Checkbox: - [x] task
  level: number;                  // 缩进层级
}

// Image
interface ImageData {
  alt: string;                    // 替代文本
  src: string;                    // URL
  title?: string;                 // 标题
  width?: number;                 // 宽度（可选）
  height?: number;                // 高度（可选）
}

// Incomplete（未完成块）
interface IncompleteData {
  partialType: FragmentType;      // 预期的完整类型
  accumulatedContent: string;     // 已累积的内容
  expectedClosePattern?: string;  // 期望的结束标记
}
```

### 2.3 Parser 状态

```typescript
interface ParserState {
  // 输入缓冲区
  buffer: string;
  
  // 已确认的完整分片（不可变）
  confirmedFragments: Fragment[];
  
  // 当前正在构建的未完成分片
  currentFragment: Fragment | null;
  
  // 解析位置
  position: number;               // 字符位置
  line: number;                   // 行号
  column: number;                 // 列号
  
  // 块级元素栈（处理嵌套）
  blockStack: BlockContext[];
}

interface BlockContext {
  type: FragmentType;
  indent: number;
  startPosition: SourcePosition;
}
```

---

## 3. 核心算法设计

### 3.1 增量解析算法

```typescript
class StreamingParser {
  appendChunk(chunk: string): void {
    // 1. 追加到缓冲区
    this.buffer += chunk;
    
    // 2. 增量解析（只处理新增部分）
    this.parseIncremental();
  }
  
  private parseIncremental(): void {
    // 从上次解析位置开始
    let pos = this.lastParsedPosition;
    
    while (pos < this.buffer.length) {
      // 尝试识别一个完整的块
      const block = this.tryParseBlock(pos);
      
      if (block) {
        // 成功识别完整块
        this.confirmFragment(block);
        pos = block.position.end;
      } else if (this.currentFragment) {
        // 继续当前未完成块
        const updated = this.continueFragment(pos);
        if (updated.isComplete) {
          this.confirmFragment(updated);
          this.currentFragment = null;
        }
        pos = this.buffer.length; // 消费到末尾
      } else {
        // 开始新块（未完成）
        this.currentFragment = this.startNewFragment(pos);
        pos = this.buffer.length;
      }
    }
    
    this.lastParsedPosition = pos;
  }
}
```

### 3.2 块识别规则

```typescript
interface BlockPattern {
  type: FragmentType;
  startPattern: RegExp;
  endPattern?: RegExp;
  isSingleLine: boolean;
  canContainImages: boolean;
}

const BLOCK_PATTERNS: BlockPattern[] = [
  {
    type: 'codeblock',
    startPattern: /^```(\w*)/,
    endPattern: /^```$/,
    isSingleLine: false,
    canContainImages: false,
  },
  {
    type: 'heading',
    startPattern: /^(#{1,6})\s+(.+)$/,
    isSingleLine: true,
    canContainImages: true,
  },
  {
    type: 'list',
    startPattern: /^([\s]*)([-*+]|\d+\.)\s/,
    isSingleLine: false,
    canContainImages: true,
  },
  {
    type: 'blockquote',
    startPattern: /^>\s*/,
    isSingleLine: false,
    canContainImages: true,
  },
  {
    type: 'paragraph',
    startPattern: /^(?!\s*$)(?![#>`\-|])/,
    isSingleLine: false,
    canContainImages: true,
  },
];
```

### 3.3 内容哈希算法

```typescript
// MurmurHash3 (32-bit)
function murmurHash3(key: string, seed: number = 0): string {
  const remainder = key.length & 3;
  const bytes = key.length - remainder;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  
  let h1 = seed;
  let i = 0;
  
  while (i < bytes) {
    let k1 = 
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);
    
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);
    
    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
    
    i += 4;
  }
  
  // 处理剩余字节...
  
  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;
  
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

// Key 生成策略
function generateKey(fragment: Fragment, index: number): string {
  if (fragment.isComplete) {
    // 已完成：内容哈希（稳定）
    return `frag-${murmurHash3(fragment.rawContent)}`;
  } else {
    // 未完成：位置+长度+时间戳（临时）
    return `temp-${index}-${fragment.rawContent.length}-${Date.now()}`;
  }
}
```

### 3.4 图片提取与分片

```typescript
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g;

function splitImages(fragment: Fragment): Fragment[] {
  const content = fragment.rawContent;
  const parts: { type: 'text' | 'image'; content: string; data?: ImageData }[] = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = IMAGE_REGEX.exec(content)) !== null) {
    // 添加图片前的文本
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }
    
    // 添加图片
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
  
  // 添加剩余文本
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }
  
  // 转换为 Fragment 数组
  return parts.map((part, i) => createFragment({
    ...fragment,
    type: part.type === 'image' ? 'image' : fragment.type,
    rawContent: part.content,
    data: part.data || { content: part.content },
  }));
}
```

### 3.5 代码块行级分片

```typescript
function splitCodeLines(codeBlock: Fragment): Fragment {
  const data = codeBlock.data as CodeBlockData;
  const lines = data.code.split('\n');
  
  data.lines = lines.map((line, index) => {
    const isLastLine = index === lines.length - 1;
    const isComplete = !isLastLine || codeBlock.isComplete;
    
    return {
      content: line,
      lineNumber: index + 1,
      isComplete,
      // 已完成行的 key：行号 + 内容哈希
      key: isComplete ? `line-${index + 1}-${murmurHash3(line)}` : `line-${index + 1}-temp`,
    };
  });
  
  return codeBlock;
}
```

---

## 4. React 渲染优化

### 4.1 组件 memo 策略

```typescript
// Fragment 渲染器 - 核心优化
const FragmentRenderer = memo(
  ({ fragment, index }: FragmentRendererProps) => {
    const Component = COMPONENT_MAP[fragment.type];
    return <Component fragment={fragment} index={index} />;
  },
  // 自定义比较：只有 key 变化才重新渲染
  (prevProps, nextProps) => {
    return prevProps.fragment.key === nextProps.fragment.key;
  }
);

// 各类型渲染器
const HeadingRenderer = memo(({ fragment }: { fragment: Fragment }) => {
  const data = fragment.data as HeadingData;
  const Tag = `h${data.level}` as keyof JSX.IntrinsicElements;
  return <Tag>{data.content}</Tag>;
});

const CodeBlockRenderer = memo(({ fragment }: { fragment: Fragment }) => {
  const data = fragment.data as CodeBlockData;
  
  useEffect(() => {
    // 只在完成时执行高亮
    if (fragment.isComplete && !data.highlighted) {
      highlightCode(data.code, data.lang).then(html => {
        data.highlighted = html;
      });
    }
  }, [fragment.isComplete]);
  
  return (
    <pre className="code-block">
      <code>
        {data.lines?.map(line => (
          <div key={line.key} className={line.isComplete ? 'complete' : 'incomplete'}>
            {line.content}
          </div>
        ))}
      </code>
    </pre>
  );
});
```

### 4.2 图片稳定渲染

```typescript
const ImageRenderer = memo(({ fragment }: { fragment: Fragment }) => {
  const data = fragment.data as ImageData;
  const [isLoaded, setIsLoaded] = useState(false);
  
  // 使用 ref 保持 DOM 节点稳定
  const imgRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    // 只在 src 变化时更新
    if (imgRef.current && imgRef.current.src !== data.src) {
      imgRef.current.src = data.src;
    }
  }, [data.src]);
  
  return (
    <img
      ref={imgRef}
      alt={data.alt}
      title={data.title}
      loading="lazy"
      style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.2s' }}
      onLoad={() => setIsLoaded(true)}
    />
  );
}, () => true); // 永远不重新渲染，DOM 节点保持稳定
```

---

## 5. 接口设计

### 5.1 Core API

```typescript
// Parser 类
class StreamingParser {
  constructor(options?: ParserOptions);
  
  // 核心方法
  appendChunk(chunk: string): void;
  getFragments(): ReadonlyArray<Fragment>;
  reset(): void;
  finalize(): ReadonlyArray<Fragment>;
  
  // 查询方法
  isComplete(): boolean;
  getBufferLength(): number;
  
  // 事件（可选）
  onFragmentComplete(callback: (fragment: Fragment) => void): () => void;
  onImageDetected(callback: (image: ImageData) => void): () => void;
}

// 工具函数
export function murmurHash3(str: string, seed?: number): string;
export function isImageInContent(content: string): boolean;
export function extractImages(content: string): ImageData[];
```

### 5.2 React API

```typescript
// Hook
export function useStreamingParser(
  content: string,
  options?: ParserOptions
): {
  fragments: Fragment[];
  isComplete: boolean;
  isStreaming: boolean;
  parser: StreamingParser;
};

// 组件
export interface StreamingMarkdownProps {
  content: string;
  options?: ParserOptions;
  components?: Partial<ComponentMap>;
  className?: string;
  onComplete?: () => void;
  onFragmentUpdate?: (fragments: Fragment[]) => void;
  onImageLoad?: (image: ImageData) => void;
}

export const StreamingMarkdown: React.FC<StreamingMarkdownProps>;

// 自定义组件类型
export type ComponentMap = {
  [K in FragmentType]: React.ComponentType<{ fragment: Fragment }>;
};
```

---

## 6. 测试策略

### 6.1 单元测试

```typescript
// parser.test.ts
describe('StreamingParser', () => {
  it('should generate stable key for same content', () => {
    const parser1 = new StreamingParser();
    parser1.appendChunk('# Hello\n');
    const key1 = parser1.getFragments()[0].key;
    
    const parser2 = new StreamingParser();
    parser2.appendChunk('# Hello\n');
    const key2 = parser2.getFragments()[0].key;
    
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^frag-/);
  });
  
  it('should split images into separate fragments', () => {
    const parser = new StreamingParser();
    parser.appendChunk('Text ![img](url.jpg) more\n\n');
    
    const fragments = parser.finalize();
    const imageFragment = fragments.find(f => f.type === 'image');
    
    expect(imageFragment).toBeDefined();
    expect(imageFragment?.data).toMatchObject({
      alt: 'img',
      src: 'url.jpg',
    });
  });
  
  it('should not re-render completed code lines', () => {
    const parser = new StreamingParser({ incompleteCodeStrategy: 'line' });
    parser.appendChunk('```js\nline1\n');
    const lines1 = (parser.getFragments()[0].data as CodeBlockData).lines;
    
    parser.appendChunk('line2\n');
    const lines2 = (parser.getFragments()[0].data as CodeBlockData).lines;
    
    // 第一行的 key 应该保持不变
    expect(lines1[0].key).toBe(lines2[0].key);
    expect(lines1[0].isComplete).toBe(true);
  });
});
```

### 6.2 集成测试

```typescript
// integration.test.tsx
describe('StreamingMarkdown', () => {
  it('should not cause image reload on content update', async () => {
    const { rerender } = render(<StreamingMarkdown content="" />);
    
    rerender(<StreamingMarkdown content="![img](test.jpg)" />);
    const img1 = screen.getByAltText('img');
    
    rerender(<StreamingMarkdown content="![img](test.jpg)\n\nMore text" />);
    const img2 = screen.getByAltText('img');
    
    // 同一个 DOM 节点
    expect(img1).toBe(img2);
  });
});
```

### 6.3 性能测试

```typescript
// performance.test.ts
it('should handle 10k tokens streaming smoothly', async () => {
  const parser = new StreamingParser();
  const chunks = generateChunks(10000, 50); // 50 字符/chunk
  
  const startTime = performance.now();
  
  for (const chunk of chunks) {
    parser.appendChunk(chunk);
    parser.getFragments();
  }
  
  const duration = performance.now() - startTime;
  
  // 应该在 100ms 内完成
  expect(duration).toBeLessThan(100);
});
```

---

## 7. 后续 Rust/WASM 规划

### 7.1 接口兼容层

```typescript
// 当前 TypeScript 实现
class StreamingParser {
  appendChunk(chunk: string): void;
  getFragments(): Fragment[];
}

// 未来 WASM 实现 - 保持完全相同的接口
class StreamingParser {
  private wasmModule: WasmModule;
  
  appendChunk(chunk: string): void {
    // 调用 WASM
    this.wasmModule.append_chunk(chunk);
  }
  
  getFragments(): Fragment[] {
    // 从 WASM 内存读取
    return this.wasmModule.get_fragments();
  }
}
```

### 7.2 迁移路径

| 阶段 | 目标 | 时间 |
|------|------|------|
| Phase 1 | TypeScript Core 稳定 | v1.0 |
| Phase 2 | Rust Core + WASM bindings | v2.0 |
| Phase 3 | 纯 Rust，TS 仅做胶水 | v3.0 |

---

## 8. 技术决策（已确认）

| # | 决策 | 选择 | 说明 |
|---|------|------|------|
| 1 | **行内元素处理** | **方案 A** | Core 只解析块级，行内留给 React 层用成熟库处理 |
| 2 | **代码高亮时机** | **异步** | 代码块完成后，React 层用 useEffect + Web Worker |
| 3 | **HTML 转义** | **默认转义** | 安全优先，防止 XSS |
| 4 | **错误处理** | **抛出错误** | 初期先抛出，后续增加配置项选择容错/抛出 |

### 8.1 行内元素处理详述

Core 层输出示例：
```typescript
// Core 输出 - data.content 包含原始 Markdown 标记
{
  type: 'paragraph',
  rawContent: 'Text with **bold** and `code`',
  data: {
    content: 'Text with **bold** and `code`',  // 未解析的行内标记
    inlineElements: []  // 可选：由 React 层填充
  }
}
```

React 层处理：
```tsx
// 使用成熟库或自定义组件解析行内标记
function ParagraphRenderer({ fragment }) {
  const { content } = fragment.data;
  // 方案：使用 react-markdown 的 inline parser
  // 或：简单正则替换
  return <p>{parseInline(content)}</p>;
}
```

**原因**：
- Core 专注核心机制（分片+key固化）
- 行内解析复杂度高（嵌套标记、转义等）
- 复用 `react-markdown` 或 `remark` 等成熟方案
- 降低 WASM 迁移成本

---

**请确认以上内容后，我将开始实现代码。**

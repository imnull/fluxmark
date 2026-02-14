# 架构设计文档

## 问题分析

### 流式渲染的挑战

在 AI 对话场景中，Markdown 内容以 chunk 形式流式到达：

```
T+0: "# Hel"
T+1: "# Hello\n\nThis"
T+2: "# Hello\n\nThis is **bo"
T+3: "# Hello\n\nThis is **bold** text.\n\n```co"
```

每次更新都触发 React 重新渲染，导致：
- 图片元素重新创建 → 重新加载 → 闪烁
- 代码块重新挂载 → 语法高亮重复执行
- DOM 操作频繁 → 性能下降

### 传统方案的局限

| 方案 | 问题 |
|------|------|
| 整文本重新解析渲染 | 所有元素重新创建，闪烁严重 |
| Virtual List | 不适合对话场景，上下文丢失 |
| React.memo 浅比较 | 文本内容变化导致 still re-render |

## 核心设计

### 1. 增量解析器 (Streaming Parser)

解析器维护内部状态，支持增量输入：

```typescript
class StreamingParser {
  private buffer: string = '';
  private fragments: Fragment[] = [];
  private incompleteFragment: Fragment | null = null;

  appendChunk(chunk: string): void {
    this.buffer += chunk;
    this.parseIncremental();
  }
}
```

### 2. 分片策略 (Fragmentation Strategy)

#### 2.1 块级识别

Markdown 块级元素边界清晰，适合作为分片单位：

```typescript
type BlockType = 
  | 'heading'      // # Title
  | 'paragraph'    // Normal text
  | 'codeblock'    // ```code```
  | 'list'         // - item
  | 'blockquote'   // > quote
  | 'image'        // ![alt](url)
  | 'thematicBreak' // ---
  | 'html'         // <div>...</div>
```

#### 2.2 特殊处理：图片分片

图片需要独立分片，即使出现在段落中：

```markdown
This is a paragraph with ![img](url) embedded.
```

分片结果：
```typescript
[
  { type: 'paragraph', content: 'This is a paragraph with ', ... },
  { type: 'image', content: '![img](url)', ... },
  { type: 'paragraph', content: ' embedded.', ... }
]
```

#### 2.3 未完成块的细粒度分片

末尾未完成块需要特殊处理，避免整体重新渲染：

```typescript
// 代码块未完成时，按行分片
const lines = codeContent.split('\n');
lines.forEach((line, index) => {
  const isLastLine = index === lines.length - 1;
  const isComplete = !isLastLine || codeBlockClosed;
  // 已完成的行 key 固化，最后一行临时 key
});
```

### 3. Key 固化机制 (Key Stabilization)

#### 3.1 Hash 算法选择

使用 MurmurHash3，快速且分布均匀：

```typescript
function generateKey(content: string, index: number, isComplete: boolean): string {
  if (isComplete) {
    // 已完成：基于内容生成稳定 hash
    return `frag-${murmurHash3(content)}`;
  } else {
    // 未完成：基于位置和长度生成临时 key
    return `temp-${index}-${content.length}-${Date.now()}`;
  }
}
```

#### 3.2 Key 的生命周期

```
Incomplete (temp-key) ──▶ Complete (hash-key)
     │                         │
     │                         │
     ▼                         ▼
  频繁更新                   永不改变
  (React re-render)          (React memo hit)
```

### 4. React 渲染优化

#### 4.1 组件结构

```tsx
function StreamingMarkdown({ content }: Props) {
  const fragments = useStreamingParser(content);
  
  return (
    <div className="markdown-body">
      {fragments.map((fragment, index) => (
        <FragmentRenderer
          key={fragment.key}
          fragment={fragment}
          index={index}
        />
      ))}
    </div>
  );
}
```

#### 4.2 Memo 优化

```tsx
const FragmentRenderer = React.memo(({ fragment }: FragmentProps) => {
  switch (fragment.type) {
    case 'codeblock':
      return <CodeBlock {...fragment} />;
    case 'image':
      return <Image {...fragment} />;
    // ...
  }
}, (prev, next) => {
  // 只有 key 相同才会命中此比较
  return prev.fragment.key === next.fragment.key;
});
```

## 数据流

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Source    │───▶│   Parser    │───▶│   Fragments │───▶│    React    │
│  (Stream)   │    │ (Stateful)  │    │  (Stable)   │    │   (Render)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   Buffer    │
                   │  (Internal) │
                   └─────────────┘
```

## 状态管理

### Parser 内部状态

```typescript
interface ParserState {
  // 已确认的完整分片
  confirmedFragments: Fragment[];
  
  // 当前正在处理的未完成分片
  currentFragment: Fragment | null;
  
  // 原始文本缓冲区
  buffer: string;
  
  // 解析位置标记
  parsePosition: number;
  
  // 块级元素栈（用于嵌套结构）
  blockStack: BlockContext[];
}
```

### Fragment 结构

```typescript
interface Fragment {
  // 唯一标识，基于内容 hash 或临时生成
  key: string;
  
  // 分片类型
  type: FragmentType;
  
  // 原始 Markdown 内容
  rawContent: string;
  
  // 解析后的结构化数据
  data: FragmentData;
  
  // 是否已完整解析
  isComplete: boolean;
  
  // 在文档中的位置
  position: Position;
  
  // 嵌套子分片（如列表项）
  children?: Fragment[];
}
```

## 边界情况处理

### 1. 代码块内的特殊字符

```markdown
```js
const s = "```";  // 这不是结束标记
```
```

处理：在代码块内，只有顶行的 ``` 才是结束标记。

### 2. 列表嵌套

```markdown
- item 1
  - nested 1
  - nested 2
- item 2
```

处理：使用缩进栈跟踪嵌套层级。

### 3. 流式截断

输入在任意位置被截断：
```markdown
# Title\n\nThis is a [link](htt  // 截断
```

处理：识别到未完成语法，标记为 incomplete，等待后续内容。

## 性能考虑

### 时间复杂度

| 操作 | 复杂度 | 说明 |
|------|--------|------|
| appendChunk | O(n) | n = chunk 长度 |
| getFragments | O(1) | 返回缓存结果 |
| Hash 计算 | O(m) | m = 内容长度，使用快速 hash |

### 空间复杂度

- Parser 状态：O(total_content)
- 分片数组：O(fragment_count)

### 优化策略

1. **懒解析**：只在调用 getFragments 时执行解析
2. **增量解析**：记录上次解析位置，避免重复处理
3. **分片复用**：已完成分片对象直接复用

## 后续 Rust/WASM 计划

### 迁移路径

```
Phase 1: TypeScript Core (当前)
         │
         ▼
Phase 2: Rust Core + WASM bindings
         │
         ▼
Phase 3: 纯 Rust 解析，TS 仅做 glue code
```

### 接口保持

WASM 版本保持相同接口：

```typescript
// 当前
import { StreamingParser } from './ts/parser';

// 未来
import { StreamingParser } from './wasm/parser'; // 接口完全一致
```

### 性能提升预期

| 指标 | TS | Rust/WASM | 提升 |
|------|-----|-----------|------|
| 解析速度 | ~10MB/s | ~100MB/s | 10x |
| Hash 计算 | ~5M ops/s | ~50M ops/s | 10x |
| 内存占用 | 基准 | -30% | 节省 |

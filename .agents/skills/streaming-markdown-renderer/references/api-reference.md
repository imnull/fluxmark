# API 参考

## Core API

### StreamingParser

核心解析器类，处理流式 Markdown 输入。

```typescript
class StreamingParser {
  constructor(options?: ParserOptions);
  
  /** 追加新的文本 chunk */
  appendChunk(chunk: string): void;
  
  /** 获取当前所有分片 */
  getFragments(): Fragment[];
  
  /** 重置解析器状态 */
  reset(): void;
  
  /** 结束流，标记所有未完成分片为完成 */
  finalize(): Fragment[];
}
```

### ParserOptions

```typescript
interface ParserOptions {
  /** 是否在 finalize 时自动高亮代码 */
  highlightCode?: boolean;
  
  /** 代码高亮函数 */
  highlightFunction?: (code: string, lang: string) => string;
  
  /** 未完成代码块的分片策略 */
  incompleteCodeStrategy?: 'line' | 'char' | 'none';
  
  /** Hash 算法 */
  hashAlgorithm?: 'murmur3' | 'fnv1a' | 'simple';
  
  /** 是否提取图片预加载 */
  preloadImages?: boolean;
}
```

### Fragment

```typescript
interface Fragment {
  /** 唯一标识符（基于内容的 hash） */
  key: string;
  
  /** 分片类型 */
  type: FragmentType;
  
  /** 原始 Markdown 内容 */
  rawContent: string;
  
  /** 解析后的数据 */
  data: FragmentData;
  
  /** 是否已完整解析 */
  isComplete: boolean;
  
  /** 在文档中的位置 */
  position: Position;
  
  /** 嵌套子分片 */
  children?: Fragment[];
  
  /** 元数据 */
  meta: FragmentMeta;
}

type FragmentType = 
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

interface Position {
  start: number;
  end: number;
  line: number;
  column: number;
}

interface FragmentMeta {
  /** 创建时间戳 */
  createdAt: number;
  
  /** 更新时间戳 */
  updatedAt: number;
  
  /** 更新次数 */
  updateCount: number;
  
  /** 是否为流式追加产生 */
  fromStreaming: boolean;
}
```

### FragmentData

不同类型分片的数据结构：

```typescript
type FragmentData = 
  | HeadingData
  | ParagraphData
  | CodeBlockData
  | ListData
  | ImageData
  | BlockquoteData
  | IncompleteData;

interface HeadingData {
  level: number;
  content: string;
}

interface ParagraphData {
  content: string;
  inlineElements: InlineElement[];
}

interface CodeBlockData {
  lang: string;
  code: string;
  highlighted?: string;
  lines: CodeLine[];
}

interface CodeLine {
  content: string;
  lineNumber: number;
  isComplete: boolean;
}

interface ListData {
  ordered: boolean;
  start: number;
  items: ListItem[];
}

interface ListItem {
  content: string;
  checked?: boolean; // for task list
  level: number;
}

interface ImageData {
  alt: string;
  src: string;
  title?: string;
  width?: number;
  height?: number;
}

interface BlockquoteData {
  content: string;
  level: number;
}

interface IncompleteData {
  partialType: FragmentType;
  accumulatedContent: string;
  expectedClosePattern?: string;
}
```

## React API

### StreamingMarkdown

```typescript
interface StreamingMarkdownProps {
  /** 当前累积的 Markdown 内容 */
  content: string;
  
  /** 自定义渲染组件 */
  components?: Partial<ComponentsMap>;
  
  /** 解析器选项 */
  parserOptions?: ParserOptions;
  
  /** 额外 CSS 类名 */
  className?: string;
  
  /** 完成回调 */
  onComplete?: () => void;
  
  /** 分片更新回调 */
  onFragmentUpdate?: (fragments: Fragment[]) => void;
}

function StreamingMarkdown(props: StreamingMarkdownProps): React.ReactElement;
```

### ComponentsMap

```typescript
interface ComponentsMap {
  heading: React.ComponentType<HeadingProps>;
  paragraph: React.ComponentType<ParagraphProps>;
  codeblock: React.ComponentType<CodeBlockProps>;
  list: React.ComponentType<ListProps>;
  listItem: React.ComponentType<ListItemProps>;
  blockquote: React.ComponentType<BlockquoteProps>;
  image: React.ComponentType<ImageProps>;
  thematicBreak: React.ComponentType<{}>;
  incomplete: React.ComponentType<IncompleteProps>;
}

// Props 类型继承自 FragmentData + 通用属性
interface BaseFragmentProps<T extends FragmentData> {
  fragment: Fragment;
  data: T;
  isComplete: boolean;
}

type HeadingProps = BaseFragmentProps<HeadingData>;
type ParagraphProps = BaseFragmentProps<ParagraphData>;
type CodeBlockProps = BaseFragmentProps<CodeBlockData>;
type ListProps = BaseFragmentProps<ListData>;
type ListItemProps = BaseFragmentProps<{}> & { item: ListItem };
type BlockquoteProps = BaseFragmentProps<BlockquoteData>;
type ImageProps = BaseFragmentProps<ImageData>;
type IncompleteProps = BaseFragmentProps<IncompleteData>;
```

### useStreamingParser Hook

```typescript
function useStreamingParser(
  content: string,
  options?: ParserOptions
): {
  fragments: Fragment[];
  isComplete: boolean;
  parser: StreamingParser;
};
```

## Utility Functions

### Hash Functions

```typescript
/** MurmurHash3 实现 */
function murmurHash3(str: string, seed?: number): string;

/** FNV-1a hash */
function fnv1a(str: string): string;

/** Simple hash (djb2) */
function djb2(str: string): string;
```

### Content Utils

```typescript
/** 检测内容是否为图片标记 */
function isImageMarker(content: string, position: number): boolean;

/** 提取图片信息 */
function extractImageInfo(content: string): ImageData | null;

/** 检测代码块边界 */
function detectCodeBlockBoundary(content: string, startPos: number): {
  lang: string;
  endPos: number | null;
};

/** 分割代码行为细粒度分片 */
function splitCodeLines(code: string): CodeLine[];
```

## 事件

### Parser Events

```typescript
interface ParserEvents {
  /** 新分片创建 */
  'fragment:create': (fragment: Fragment) => void;
  
  /** 分片内容更新 */
  'fragment:update': (fragment: Fragment, delta: string) => void;
  
  /** 分片完成 */
  'fragment:complete': (fragment: Fragment) => void;
  
  /** 图片标记发现 */
  'image:detected': (imageData: ImageData, position: Position) => void;
}
```

## 类型别名

```typescript
/** 流式内容输入类型 */
type StreamContent = string | ReadableStream<string> | AsyncIterable<string>;

/** 分片过滤函数 */
type FragmentFilter = (fragment: Fragment) => boolean;

/** 分片排序函数 */
type FragmentComparator = (a: Fragment, b: Fragment) => number;

/** 自定义 key 生成函数 */
type KeyGenerator = (fragment: Fragment, index: number) => string;
```

## 常量

```typescript
const FRAGMENT_TYPES = {
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  CODEBLOCK: 'codeblock',
  LIST: 'list',
  LIST_ITEM: 'listItem',
  BLOCKQUOTE: 'blockquote',
  IMAGE: 'image',
  THEMATIC_BREAK: 'thematicBreak',
  HTML: 'html',
  TABLE: 'table',
  INCOMPLETE: 'incomplete',
} as const;

const DEFAULT_OPTIONS: Required<ParserOptions> = {
  highlightCode: true,
  highlightFunction: defaultHighlighter,
  incompleteCodeStrategy: 'line',
  hashAlgorithm: 'murmur3',
  preloadImages: false,
};
```

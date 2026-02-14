/**
 * 流式 Markdown 解析器类型定义
 */

// ===== 分片类型 =====

export type FragmentType = 
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

// ===== 位置信息 =====

export interface SourcePosition {
  /** 起始字符索引 */
  start: number;
  /** 结束字符索引 */
  end: number;
  /** 起始行号（1-based） */
  line: number;
  /** 起始列号（1-based） */
  column: number;
}

// ===== 元数据 =====

export interface FragmentMeta {
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 更新次数 */
  updateCount: number;
  /** 是否来自流式解析 */
  fromStreaming: boolean;
}

// ===== 分片数据 =====

export interface Fragment {
  /** 唯一标识符 */
  key: string;
  /** 分片类型 */
  type: FragmentType;
  /** 原始 Markdown 内容 */
  rawContent: string;
  /** 是否已完整解析 */
  isComplete: boolean;
  /** 在原始文本中的位置 */
  position: SourcePosition;
  /** 结构化数据（类型特定） */
  data: FragmentData;
  /** 嵌套子分片 */
  children?: Fragment[];
  /** 元数据 */
  meta: FragmentMeta;
}

// ===== 各类型分片数据 =====

export type FragmentData = 
  | HeadingData
  | ParagraphData
  | CodeBlockData
  | ListData
  | ListItemData
  | ImageData
  | BlockquoteData
  | IncompleteData;

/** Heading 数据 */
export interface HeadingData {
  level: number;
  content: string;
}

/** Paragraph 数据 */
export interface ParagraphData {
  content: string;
  hasInlineImages: boolean;
}

/** Code Block 数据 */
export interface CodeBlockData {
  lang: string;
  code: string;
  /** 分行数据（细粒度分片） */
  lines?: CodeLine[];
}

export interface CodeLine {
  content: string;
  lineNumber: number;
  isComplete: boolean;
}

/** List 数据 */
export interface ListData {
  ordered: boolean;
  start: number;
  items: ListItemData[];
}

export interface ListItemData {
  content: string;
  checked?: boolean;
  level: number;
}

/** Image 数据 */
export interface ImageData {
  alt: string;
  src: string;
  title?: string;
}

/** Blockquote 数据 */
export interface BlockquoteData {
  content: string;
  level: number;
}

/** Incomplete 数据 */
export interface IncompleteData {
  partialType: FragmentType;
  accumulatedContent: string;
}

// ===== 解析器选项 =====

export interface ParserOptions {
  /** 未完成代码块的分片策略 */
  incompleteCodeStrategy?: 'line' | 'char' | 'none';
  /** Hash 算法选择 */
  hashAlgorithm?: 'murmur3' | 'djb2';
  /** 是否预加载图片 */
  preloadImages?: boolean;
}

// ===== 内部状态 =====

export interface ParserState {
  buffer: string;
  fragments: Fragment[];
  currentFragment: Fragment | null;
  position: number;
  line: number;
  column: number;
  /** 上次处理到的行索引 */
  lastProcessedLineIndex: number;
}

// ===== 块级模式 =====

export interface BlockPattern {
  type: FragmentType;
  startPattern: RegExp;
  endPattern?: RegExp;
  isSingleLine: boolean;
  canContainImages: boolean;
}

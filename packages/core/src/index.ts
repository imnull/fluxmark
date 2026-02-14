/**
 * Streaming Markdown Parser - Core
 * 
 * 流式 Markdown 解析器核心库
 * 
 * @example
 * ```typescript
 * import { StreamingParser } from '@streaming-markdown/core';
 * 
 * const parser = new StreamingParser();
 * 
 * // 流式输入
 * parser.appendChunk("# Hello\\n\\n");
 * parser.appendChunk("This is a **test**.");
 * 
 * const fragments = parser.getFragments();
 * console.log(fragments);
 * 
 * // 结束流
 * parser.finalize();
 * ```
 */

// 核心类
export { StreamingParser } from './parser.js';

// 工具函数
export { 
  murmurHash3, 
  djb2, 
  generateFragmentKey,
  generateCodeLineKey 
} from './utils/hash.js';

// 类型定义
export type {
  // 分片
  Fragment,
  FragmentType,
  FragmentData,
  FragmentMeta,
  
  // 位置
  SourcePosition,
  
  // 各类型数据
  HeadingData,
  ParagraphData,
  CodeBlockData,
  CodeLine,
  ListData,
  ListItemData,
  ImageData,
  BlockquoteData,
  IncompleteData,
  
  // 解析器
  ParserOptions,
  ParserState,
  BlockPattern,
} from './types/index.js';

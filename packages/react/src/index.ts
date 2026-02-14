/**
 * Streaming Markdown React
 * 
 * React 组件库入口
 * 
 * @example
 * ```tsx
 * import { StreamingMarkdown } from '@streaming-markdown/react';
 * import '@streaming-markdown/react/styles';
 * 
 * function ChatMessage({ content }) {
 *   return <StreamingMarkdown content={content} />;
 * }
 * ```
 */

// 主组件
export { StreamingMarkdown } from './components/StreamingMarkdown.js';
export type { StreamingMarkdownProps } from './types/index.js';

// Hook
export { useStreamingParser } from './hooks/useStreamingParser.js';
export type { UseStreamingParserReturn } from './types/index.js';

// 渲染器组件（可单独使用或自定义）
export {
  HeadingRenderer,
  ParagraphRenderer,
  CodeBlockRenderer,
  ListRenderer,
  ListItemRenderer,
  BlockquoteRenderer,
  ImageRenderer,
  ThematicBreakRenderer,
  IncompleteRenderer,
} from './components/FragmentRenderers.js';

// 类型
export type {
  // Fragment 类型
  Fragment,
  ParserOptions,
  // 组件 Props
  BaseFragmentProps,
  HeadingProps,
  ParagraphProps,
  CodeBlockProps,
  ListProps,
  ListItemProps,
  BlockquoteProps,
  ImageProps,
  ThematicBreakProps,
  IncompleteProps,
  // 高亮
  HighlightFunction,
  HighlightOptions,
  // 组件映射
  ComponentMap,
} from './types/index.js';

// 默认导出
export { default } from './components/StreamingMarkdown.js';

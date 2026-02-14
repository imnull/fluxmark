/**
 * React 组件类型定义
 */

import type { Fragment, ParserOptions } from '@streaming-markdown/core';
import type { ComponentType } from 'react';

export type { Fragment, ParserOptions };

// ===== 组件 Props =====

export interface StreamingMarkdownProps {
  /** 当前累积的 Markdown 内容 */
  content: string;
  /** 解析器配置 */
  options?: ParserOptions;
  /** 自定义渲染组件 */
  components?: Partial<ComponentMap>;
  /** 容器 CSS 类名 */
  className?: string;
  /** 所有分片完成时的回调 */
  onComplete?: () => void;
  /** 分片更新时的回调 */
  onFragmentUpdate?: (fragments: Fragment[]) => void;
}

export interface UseStreamingParserReturn {
  /** 当前所有分片 */
  fragments: Fragment[];
  /** 是否全部完成 */
  isComplete: boolean;
  /** 是否正在流式输入 */
  isStreaming: boolean;
}

// ===== 渲染器组件类型 =====

export type ComponentMap = {
  heading: ComponentType<HeadingProps>;
  paragraph: ComponentType<ParagraphProps>;
  codeblock: ComponentType<CodeBlockProps>;
  list: ComponentType<ListProps>;
  listItem: ComponentType<ListItemProps>;
  blockquote: ComponentType<BlockquoteProps>;
  image: ComponentType<ImageProps>;
  thematicBreak: ComponentType<ThematicBreakProps>;
  incomplete: ComponentType<IncompleteProps>;
};

export interface BaseFragmentProps {
  fragment: Fragment;
  /** 是否为流式未完成状态 */
  isStreaming?: boolean;
}

export interface HeadingProps extends BaseFragmentProps {
  level: number;
  content: string;
}

export interface ParagraphProps extends BaseFragmentProps {
  content: string;
  hasInlineImages?: boolean;
}

export interface CodeLine {
  content: string;
  lineNumber: number;
  isComplete: boolean;
}

export interface CodeBlockProps extends BaseFragmentProps {
  lang: string;
  code: string;
  lines?: CodeLine[];
  highlight?: HighlightFunction;
}

export interface ListItem {
  content: string;
  checked?: boolean;
  level: number;
}

export interface ListProps extends BaseFragmentProps {
  ordered: boolean;
  items: ListItem[];
}

export interface ListItemProps extends BaseFragmentProps {
  item: ListItem;
  index: number;
}

export interface BlockquoteProps extends BaseFragmentProps {
  content: string;
  level: number;
}

export interface ImageProps extends BaseFragmentProps {
  src: string;
  alt: string;
  title?: string;
}

export interface ThematicBreakProps extends BaseFragmentProps {}

export interface IncompleteProps extends BaseFragmentProps {
  partialType: string;
  accumulatedContent: string;
}

// ===== 高亮配置 =====

export type HighlightFunction = (code: string, lang: string) => string | Promise<string>;

export interface HighlightOptions {
  /** 高亮函数 */
  highlight?: HighlightFunction;
  /** 是否使用 Web Worker */
  useWorker?: boolean;
}

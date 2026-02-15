/**
 * Angular 组件类型定义
 */

import type { Fragment, ParserOptions } from '@streaming-markdown/core';

export type { Fragment, ParserOptions };

// ===== 组件 Inputs =====

export interface StreamingMarkdownInputs {
  /** 当前累积的 Markdown 内容 */
  content: string;
  /** 解析器配置 */
  options?: ParserOptions;
  /** 容器 CSS 类名 */
  class?: string;
}

export interface StreamingMarkdownOutputs {
  /** 所有分片完成时触发 */
  complete: void;
  /** 分片更新时触发 */
  fragmentUpdate: Fragment[];
}

// ===== 渲染器组件 Inputs =====

export interface BaseFragmentInputs {
  fragment: Fragment;
  /** 是否为流式未完成状态 */
  isStreaming?: boolean;
}

export interface HeadingInputs extends BaseFragmentInputs {
  level: number;
  content: string;
}

export interface ParagraphInputs extends BaseFragmentInputs {
  content: string;
  hasInlineImages?: boolean;
}

export interface CodeLine {
  content: string;
  lineNumber: number;
  isComplete: boolean;
}

export interface CodeBlockInputs extends BaseFragmentInputs {
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

export interface ListInputs extends BaseFragmentInputs {
  ordered: boolean;
  items: ListItem[];
}

export interface ListItemInputs extends BaseFragmentInputs {
  item: ListItem;
  index: number;
}

export interface BlockquoteInputs extends BaseFragmentInputs {
  content: string;
  level: number;
}

export interface ImageInputs extends BaseFragmentInputs {
  src: string;
  alt: string;
  title?: string;
  href?: string;
}

export interface ThematicBreakInputs extends BaseFragmentInputs {}

export interface IncompleteInputs extends BaseFragmentInputs {
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

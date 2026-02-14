/**
 * StreamingMarkdown 组件
 * 
 * 流式 Markdown 渲染的主组件
 */

import React, { memo, useMemo, useEffect } from 'react';
import { useStreamingParser } from '../hooks/useStreamingParser.js';
import {
  HeadingRenderer,
  ParagraphRenderer,
  CodeBlockRenderer,
  ListRenderer,
  ListItemRenderer,
  BlockquoteRenderer,
  ImageRenderer,
  ThematicBreakRenderer,
  IncompleteRenderer,
} from './FragmentRenderers.js';
import type {
  StreamingMarkdownProps,
  Fragment,
  ComponentMap,
  BaseFragmentProps,
  HighlightFunction,
} from '../types/index.js';

// 默认组件映射
const defaultComponents: ComponentMap = {
  heading: HeadingRenderer,
  paragraph: ParagraphRenderer,
  codeblock: CodeBlockRenderer,
  list: ListRenderer,
  listItem: ListItemRenderer,
  blockquote: BlockquoteRenderer,
  image: ImageRenderer,
  thematicBreak: ThematicBreakRenderer,
  incomplete: IncompleteRenderer,
};

// Fragment 渲染器包装组件
interface FragmentRendererProps {
  fragment: Fragment;
  component: React.ComponentType<BaseFragmentProps & Record<string, unknown>>;
  isStreaming: boolean;
  highlight?: HighlightFunction;
}

const FragmentRenderer = memo(function FragmentRenderer({
  fragment,
  component: Component,
  isStreaming,
  highlight,
}: FragmentRendererProps) {
  // 根据 fragment 类型提取数据
  const componentProps = useMemo(() => {
    const baseProps: BaseFragmentProps = {
      fragment,
      isStreaming,
    };

    switch (fragment.type) {
      case 'heading': {
        const data = fragment.data as { level: number; content: string };
        return { ...baseProps, ...data };
      }
      case 'paragraph': {
        const data = fragment.data as { content: string; hasInlineImages?: boolean };
        return { ...baseProps, ...data };
      }
      case 'codeblock': {
        const data = fragment.data as { 
          lang: string; 
          code: string; 
          lines?: { content: string; lineNumber: number; isComplete: boolean }[] 
        };
        return { ...baseProps, ...data, highlight };
      }
      case 'list': {
        const data = fragment.data as { ordered: boolean; items: unknown[] };
        return { ...baseProps, ...data };
      }
      case 'blockquote': {
        const data = fragment.data as { content: string; level: number };
        return { ...baseProps, ...data };
      }
      case 'image': {
        const data = fragment.data as { src: string; alt: string; title?: string; href?: string };
        return { ...baseProps, ...data };
      }
      case 'incomplete': {
        const data = fragment.data as { partialType: string; accumulatedContent: string };
        return { ...baseProps, ...data };
      }
      default:
        return baseProps;
    }
  }, [fragment, isStreaming, highlight]);

  return <Component {...componentProps} />;
}, (prevProps, nextProps) => {
  // 关键优化：只有 fragment.key 相同时才跳过渲染
  return prevProps.fragment.key === nextProps.fragment.key &&
         prevProps.isStreaming === nextProps.isStreaming;
});

// 主组件
export function StreamingMarkdown({
  content,
  options,
  components,
  className,
  onComplete,
  onFragmentUpdate,
}: StreamingMarkdownProps) {
  // 使用 Hook 获取解析状态
  const { fragments, isComplete, isStreaming } = useStreamingParser(
    content,
    options
  );

  // 合并默认和自定义组件
  const mergedComponents = useMemo(
    () => ({ ...defaultComponents, ...components }),
    [components]
  );

  // 完成回调
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  // 分片更新回调
  useEffect(() => {
    if (onFragmentUpdate) {
      onFragmentUpdate(fragments);
    }
  }, [fragments, onFragmentUpdate]);

  return (
    <div 
      className={[
        'streaming-markdown',
        isStreaming ? 'md-streaming' : 'md-complete',
        className || '',
      ].join(' ')}
    >
      {fragments.map((fragment) => {
        const Component = (mergedComponents as unknown as Record<string, React.ComponentType<BaseFragmentProps & Record<string, unknown>> | undefined>)[fragment.type];
        
        if (!Component) {
          // 未知类型，显示原始内容
          return (
            <div 
              key={fragment.key} 
              className="md-unknown"
            >
              {fragment.rawContent}
            </div>
          );
        }

        return (
          <FragmentRenderer
            key={fragment.key}
            fragment={fragment}
            component={Component}
            isStreaming={isStreaming}
          />
        );
      })}
    </div>
  );
}

StreamingMarkdown.displayName = 'StreamingMarkdown';

export default StreamingMarkdown;

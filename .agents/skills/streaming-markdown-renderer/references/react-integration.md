# React 集成方案

## 组件架构

```
StreamingMarkdown (容器)
    │
    ├── useStreamingParser (Hook - 状态管理)
    │
    └── FragmentRenderer (分片渲染器 - memo)
            │
            ├── HeadingRenderer
            ├── ParagraphRenderer
            ├── CodeBlockRenderer
            ├── ListRenderer
            ├── ImageRenderer
            └── ...
```

## Hook 设计

### useStreamingParser

```typescript
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StreamingParser } from '../core/parser';
import type { Fragment, ParserOptions } from '../core/types';

interface UseStreamingParserReturn {
  fragments: Fragment[];
  isComplete: boolean;
  isStreaming: boolean;
  parser: StreamingParser;
  reset: () => void;
}

export function useStreamingParser(
  content: string,
  options?: ParserOptions
): UseStreamingParserReturn {
  const parserRef = useRef<StreamingParser | null>(null);
  const lastLengthRef = useRef<number>(0);
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const parser = useMemo(() => {
    if (!parserRef.current) {
      parserRef.current = new StreamingParser(options);
    }
    return parserRef.current;
  }, []);

  useEffect(() => {
    const newLength = content.length;
    
    if (newLength > lastLengthRef.current) {
      setIsStreaming(true);
      const newChunk = content.slice(lastLengthRef.current);
      parser.appendChunk(newChunk);
      setFragments(parser.getFragments());
      lastLengthRef.current = newLength;
      
      // 防抖标记流式状态结束
      const timer = setTimeout(() => setIsStreaming(false), 100);
      return () => clearTimeout(timer);
    } else if (newLength < lastLengthRef.current) {
      // 内容重置
      parser.reset();
      parser.appendChunk(content);
      setFragments(parser.getFragments());
      lastLengthRef.current = newLength;
    }
  }, [content, parser]);

  const reset = useCallback(() => {
    parser.reset();
    setFragments([]);
    lastLengthRef.current = 0;
  }, [parser]);

  const isComplete = useMemo(
    () => fragments.every(f => f.isComplete),
    [fragments]
  );

  return { fragments, isComplete, isStreaming, parser, reset };
}
```

## 组件实现

### StreamingMarkdown

```tsx
import React, { memo, useMemo } from 'react';
import { useStreamingParser } from '../hooks/useStreamingParser';
import type { Fragment, FragmentType, ParserOptions } from '../core/types';
import './StreamingMarkdown.css';

// 组件映射类型
export type ComponentMap = Partial<
  Record<FragmentType, React.ComponentType<{ fragment: Fragment }>>
>;

export interface StreamingMarkdownProps {
  content: string;
  options?: ParserOptions;
  components?: ComponentMap;
  className?: string;
  onComplete?: () => void;
  onFragmentUpdate?: (fragments: Fragment[]) => void;
}

// 默认组件
const DefaultHeading: React.FC<{ fragment: Fragment }> = ({ fragment }) => {
  const data = fragment.data as { level: number; content: string };
  const Tag = `h${data.level}` as keyof JSX.IntrinsicElements;
  return <Tag>{data.content}</Tag>;
};

const DefaultParagraph: React.FC<{ fragment: Fragment }> = ({ fragment }) => {
  const data = fragment.data as { content: string };
  return <p>{data.content}</p>;
};

const DefaultCodeBlock: React.FC<{ fragment: Fragment }> = ({ fragment }) => {
  const data = fragment.data as { 
    lang: string; 
    code: string;
    lines?: { content: string; isComplete: boolean }[];
  };
  
  return (
    <pre className="code-block">
      <code className={data.lang ? `language-${data.lang}` : undefined}>
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
};

const DefaultImage: React.FC<{ fragment: Fragment }> = ({ fragment }) => {
  const data = fragment.data as { alt: string; src: string; title?: string };
  
  return (
    <figure>
      <img 
        src={data.src} 
        alt={data.alt} 
        title={data.title}
        loading="lazy"
      />
      {data.alt && <figcaption>{data.alt}</figcaption>}
    </figure>
  );
};

const DefaultList: React.FC<{ fragment: Fragment }> = ({ fragment }) => {
  const data = fragment.data as { 
    ordered: boolean; 
    items: { content: string; checked?: boolean }[];
  };
  
  const ListTag = data.ordered ? 'ol' : 'ul';
  
  return (
    <ListTag>
      {data.items.map((item, i) => (
        <li key={i} className={item.checked !== undefined ? 'task-item' : ''}>
          {item.checked !== undefined && (
            <input type="checkbox" checked={item.checked} readOnly />
          )}
          {item.content}
        </li>
      ))}
    </ListTag>
  );
};

const DefaultBlockquote: React.FC<{ fragment: Fragment }> = ({ fragment }) => {
  const data = fragment.data as { content: string; level: number };
  return (
    <blockquote className={`level-${data.level}`}>
      {data.content}
    </blockquote>
  );
};

// 分片渲染器 - 关键优化点
const FragmentRenderer = memo(({ 
  fragment, 
  component: Component 
}: { 
  fragment: Fragment;
  component: React.ComponentType<{ fragment: Fragment }>;
}) => {
  return <Component fragment={fragment} />;
}, (prevProps, nextProps) => {
  // 只有 key 相同才不会触发重新渲染
  return prevProps.fragment.key === nextProps.fragment.key;
});

FragmentRenderer.displayName = 'FragmentRenderer';

export const StreamingMarkdown: React.FC<StreamingMarkdownProps> = ({
  content,
  options,
  components,
  className,
  onComplete,
  onFragmentUpdate,
}) => {
  const { fragments, isComplete } = useStreamingParser(content, options);

  // 合并默认和自定义组件
  const mergedComponents = useMemo(() => ({
    heading: DefaultHeading,
    paragraph: DefaultParagraph,
    codeblock: DefaultCodeBlock,
    list: DefaultList,
    blockquote: DefaultBlockquote,
    image: DefaultImage,
    ...components,
  }), [components]);

  // 完成回调
  React.useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  // 分片更新回调
  React.useEffect(() => {
    if (onFragmentUpdate) {
      onFragmentUpdate(fragments);
    }
  }, [fragments, onFragmentUpdate]);

  return (
    <div className={`streaming-markdown ${className || ''}`}>
      {fragments.map((fragment) => {
        const Component = mergedComponents[fragment.type];
        if (!Component) {
          return <div key={fragment.key}>{fragment.rawContent}</div>;
        }
        return (
          <FragmentRenderer 
            key={fragment.key}
            fragment={fragment}
            component={Component}
          />
        );
      })}
    </div>
  );
};
```

## 图片防闪烁优化

图片是最容易产生闪烁的元素，需要特殊处理：

```tsx
import React, { useState, useEffect, useRef } from 'react';

interface StableImageProps {
  src: string;
  alt: string;
  title?: string;
}

// 稳定图片组件 - 防止重新加载
const StableImage: React.FC<StableImageProps> = ({ src, alt, title }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 使用 ref 保持 DOM 节点
  useEffect(() => {
    if (imgRef.current && imgRef.current.src !== src) {
      imgRef.current.src = src;
    }
  }, [src]);

  return (
    <img
      ref={imgRef}
      alt={alt}
      title={title}
      loading="lazy"
      style={{
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 0.3s',
      }}
      onLoad={() => setIsLoaded(true)}
    />
  );
};

// 使用 useMemo 确保图片组件不重新创建
const MemoizedImage = React.memo(StableImage, () => true);
```

## 代码高亮优化

使用 Web Worker 或 requestIdleCallback 避免阻塞主线程：

```tsx
import { useEffect, useState, useRef } from 'react';
import type { Fragment } from '../core/types';

interface CodeBlockWithHighlightProps {
  fragment: Fragment;
}

export const CodeBlockWithHighlight: React.FC<CodeBlockWithHighlightProps> = ({ fragment }) => {
  const data = fragment.data as { 
    lang: string; 
    code: string;
    lines?: { content: string; isComplete: boolean }[];
  };
  
  const [highlighted, setHighlighted] = useState<string>('');
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // 创建高亮 Worker
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/highlight.worker.ts', import.meta.url)
      );
      
      workerRef.current.onmessage = (e) => {
        setHighlighted(e.data.highlighted);
      };
    }

    // 只对已完成的代码块进行高亮
    if (fragment.isComplete && data.code) {
      workerRef.current.postMessage({
        code: data.code,
        lang: data.lang,
      });
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, [fragment.isComplete, data.code, data.lang]);

  return (
    <pre className="code-block">
      <code 
        className={data.lang ? `language-${data.lang}` : undefined}
        dangerouslySetInnerHTML={
          highlighted ? { __html: highlighted } : undefined
        }
      >
        {!highlighted && (
          data.lines ? (
            data.lines.map((line, i) => (
              <div key={i} className="code-line">{line.content}</div>
            ))
          ) : data.code
        )}
      </code>
    </pre>
  );
};
```

## 虚拟滚动（长文档优化）

对于超长 Markdown 文档，使用虚拟滚动：

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualizedMarkdownProps {
  fragments: Fragment[];
  containerHeight: number;
}

export const VirtualizedMarkdown: React.FC<VirtualizedMarkdownProps> = ({
  fragments,
  containerHeight,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: fragments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 50, []),
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <div ref={parentRef} style={{ height: containerHeight, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={fragments[virtualItem.index].key}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <FragmentRenderer fragment={fragments[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

## 使用示例

### 基础用法

```tsx
import { StreamingMarkdown } from 'streaming-markdown-react';

function ChatMessage({ message }) {
  return (
    <StreamingMarkdown 
      content={message.content}
      options={{ incompleteCodeStrategy: 'line' }}
    />
  );
}
```

### 自定义组件

```tsx
import { StreamingMarkdown } from 'streaming-markdown-react';

const CustomCodeBlock = ({ fragment }) => {
  const data = fragment.data;
  return (
    <div className="my-code-block">
      <div className="code-header">{data.lang}</div>
      <pre><code>{data.code}</code></pre>
    </div>
  );
};

function App() {
  return (
    <StreamingMarkdown
      content={content}
      components={{
        codeblock: CustomCodeBlock,
      }}
    />
  );
}
```

### 与状态管理集成

```tsx
import { create } from 'zustand';
import { StreamingMarkdown } from 'streaming-markdown-react';

const useChatStore = create((set) => ({
  messages: [],
  updateMessage: (id, content) => 
    set((state) => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, content } : m
      )
    })),
}));

function Chat() {
  const messages = useChatStore(state => state.messages);
  
  return (
    <div className="chat">
      {messages.map(msg => (
        <div key={msg.id} className="message">
          <StreamingMarkdown content={msg.content} />
        </div>
      ))}
    </div>
  );
}
```

## 最佳实践

1. **key 稳定性**：确保已完成分片的 key 基于内容 hash，不要包含时间戳
2. **细粒度更新**：未完成分片使用临时 key，但要控制更新频率
3. **图片预加载**：检测到图片 URL 时提前预加载
4. **防抖渲染**：流式输入时适当防抖，减少渲染次数
5. **内存管理**：长对话及时清理已完成分片（可选）

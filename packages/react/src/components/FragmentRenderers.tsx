/**
 * Fragment 渲染器组件
 * 
 * 各类型分片的 React 渲染实现，使用 memo 优化防止不必要的重渲染
 */

import React, { memo, useState, useEffect } from 'react';

import type {
  BaseFragmentProps,
  HighlightFunction,
} from '../types/index.js';

// ===== Heading 渲染器 =====

interface HeadingProps extends BaseFragmentProps {
  level: number;
  content: string;
}

export const HeadingRenderer = memo(function HeadingRenderer({ 
  level, 
  content 
}: HeadingProps) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag className={`md-heading md-h${level}`}>{content}</Tag>;
});

// ===== Paragraph 渲染器 =====

interface ParagraphProps extends BaseFragmentProps {
  content: string;
  hasInlineImages?: boolean;
}

export const ParagraphRenderer = memo(function ParagraphRenderer({ 
  content 
}: ParagraphProps) {
  // 简单的行内标记解析
  const processedContent = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

  return (
    <p 
      className="md-paragraph"
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
});

// ===== CodeBlock 渲染器 =====

interface CodeLine {
  content: string;
  lineNumber: number;
  isComplete: boolean;
}

interface CodeBlockProps extends BaseFragmentProps {
  lang: string;
  code: string;
  lines?: CodeLine[];
  highlight?: HighlightFunction;
}

export const CodeBlockRenderer = memo(function CodeBlockRenderer({
  lang,
  code,
  lines,
  fragment,
  highlight,
}: CodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>('');
  const [isHighlighting, setIsHighlighting] = useState(false);

  useEffect(() => {
    // 只有完成的代码块才进行高亮
    if (fragment.isComplete && highlight && code) {
      setIsHighlighting(true);
      
      // 异步高亮
      Promise.resolve(highlight(code, lang))
        .then(html => {
          setHighlightedCode(html);
          setIsHighlighting(false);
        })
        .catch(() => {
          setIsHighlighting(false);
        });
    }
  }, [fragment.isComplete, code, lang, highlight]);

  // 如果有行级数据且代码未完成，按行渲染
  if (lines && lines.length > 0 && !fragment.isComplete) {
    return (
      <pre className="md-codeblock md-codeblock-streaming">
        <code className={lang ? `language-${lang}` : undefined}>
          {lines.map((line, index) => (
            <div
              key={index}
              className={`md-code-line ${line.isComplete ? 'md-complete' : 'md-incomplete'}`}
              data-line-number={line.lineNumber}
            >
              {line.content}
            </div>
          ))}
        </code>
      </pre>
    );
  }

  // 完成的代码块，使用高亮或原始代码
  return (
    <pre className="md-codeblock">
      <code 
        className={lang ? `language-${lang}` : undefined}
        dangerouslySetInnerHTML={
          highlightedCode 
            ? { __html: highlightedCode }
            : undefined
        }
      >
        {!highlightedCode && code}
      </code>
      {isHighlighting && <span className="md-highlighting-indicator" />}
    </pre>
  );
}, (prevProps, nextProps) => {
  // 只有 key 相同才不重新渲染
  return prevProps.fragment.key === nextProps.fragment.key;
});

// ===== List 渲染器 =====

interface ListItem {
  content: string;
  checked?: boolean;
  level: number;
}

interface ListProps extends BaseFragmentProps {
  ordered: boolean;
  items: ListItem[];
}

export const ListRenderer = memo(function ListRenderer({
  ordered,
  children,
}: ListProps & { children?: React.ReactNode }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`md-list ${ordered ? 'md-ordered-list' : 'md-unordered-list'}`}>
      {children}
    </Tag>
  );
});

interface ListItemProps extends BaseFragmentProps {
  item: ListItem;
  index: number;
}

export const ListItemRenderer = memo(function ListItemRenderer({
  item,
}: ListItemProps) {
  return (
    <li className={`md-list-item ${item.checked !== undefined ? 'md-task-item' : ''}`}>
      {item.checked !== undefined && (
        <input 
          type="checkbox" 
          checked={item.checked} 
          readOnly 
          className="md-task-checkbox"
        />
      )}
      {item.content}
    </li>
  );
});

// ===== Blockquote 渲染器 =====

interface BlockquoteProps extends BaseFragmentProps {
  content: string;
  level: number;
}

export const BlockquoteRenderer = memo(function BlockquoteRenderer({
  content,
  level,
}: BlockquoteProps) {
  return (
    <blockquote className={`md-blockquote md-blockquote-level-${level}`}>
      <p>{content}</p>
    </blockquote>
  );
});

// ===== Image 渲染器（重点优化：防止闪烁）=====

interface ImageProps extends BaseFragmentProps {
  src: string;
  alt: string;
  title?: string;
  href?: string;
}

export const ImageRenderer = memo(function ImageRenderer({
  src,
  alt,
  title,
  href,
}: ImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 预加载图片
  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setHasError(true);
  }, [src]);

  const imageElement = hasError ? (
    <div 
      style={{
        padding: '20px',
        background: '#f5f5f5',
        border: '1px dashed #ccc',
        borderRadius: '4px',
        textAlign: 'center',
        color: '#666',
      }}
    >
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>🖼️</div>
      <div style={{ fontSize: '14px' }}>{alt || '图片加载失败'}</div>
      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
        {src.slice(0, 50)}...
      </div>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      title={title}
      loading="lazy"
      className={`md-image ${isLoaded ? 'md-loaded' : 'md-loading'}`}
      style={{
        opacity: isLoaded ? 1 : 0.5,
        transition: 'opacity 0.3s ease',
        minHeight: '100px',
        background: '#f0f0f0',
      }}
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
    />
  );

  const content = (
    <figure className={`md-image-wrapper ${hasError ? 'md-image-error' : ''}`}>
      {imageElement}
      {alt && <figcaption className="md-image-caption">{alt}</figcaption>}
    </figure>
  );

  // 如果有链接，包裹在 <a> 标签中
  if (href) {
    return (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="md-image-link"
        style={{ textDecoration: 'none' }}
      >
        {content}
      </a>
    );
  }

  return content;
}, () => true); // Image 永远不接受新 props 的更新

// ===== ThematicBreak 渲染器 =====

export const ThematicBreakRenderer = memo(function ThematicBreakRenderer() {
  return <hr className="md-hr" />;
});

// ===== Incomplete 渲染器（流式未完成状态）=====

interface IncompleteProps extends BaseFragmentProps {
  partialType: string;
  accumulatedContent: string;
}

export const IncompleteRenderer = memo(function IncompleteRenderer({
  partialType,
  accumulatedContent,
}: IncompleteProps) {
  return (
    <div className="md-incomplete md-pending">
      {/* 根据 partialType 显示预览 */}
      {partialType === 'paragraph' && (
        <p className="md-paragraph md-incomplete-content">
          {accumulatedContent}
          <span className="md-cursor">▋</span>
        </p>
      )}
      {partialType === 'codeblock' && (
        <pre className="md-codeblock md-incomplete-content">
          <code>{accumulatedContent}</code>
        </pre>
      )}
      {/* 其他类型显示原始内容 */}
      {!['paragraph', 'codeblock'].includes(partialType) && (
        <div className="md-raw md-incomplete-content">
          {accumulatedContent}
        </div>
      )}
    </div>
  );
});

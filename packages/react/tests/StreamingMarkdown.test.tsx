/**
 * StreamingMarkdown 组件测试
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StreamingMarkdown } from '../src/index.js';

describe('StreamingMarkdown', () => {
  it('should render heading', () => {
    render(<StreamingMarkdown content="# Hello World\n" />);
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('should render paragraph', () => {
    render(<StreamingMarkdown content="This is a paragraph.\n\n" />);
    expect(screen.getByText('This is a paragraph.')).toBeDefined();
  });

  it('should render code block', () => {
    render(<StreamingMarkdown content="```js\nconst x = 1;\n```\n" />);
    expect(screen.getByText('const x = 1;')).toBeDefined();
  });

  it('should render image', () => {
    render(<StreamingMarkdown content="![alt](image.jpg)\n\n" />);
    const img = screen.getByAltText('alt');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('image.jpg');
  });

  it('should call onComplete when content is complete', () => {
    const onComplete = vi.fn();
    render(
      <StreamingMarkdown 
        content="# Title\n\nComplete paragraph.\n\n" 
        onComplete={onComplete}
      />
    );
    expect(onComplete).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <StreamingMarkdown 
        content="Test" 
        className="custom-class"
      />
    );
    expect(container.firstChild?.classList.contains('custom-class')).toBe(true);
  });

  it('should render multiple fragments', () => {
    render(
      <StreamingMarkdown 
        content="# Heading\n\nParagraph 1\n\nParagraph 2\n\n" 
      />
    );
    expect(screen.getByText('Heading')).toBeDefined();
    expect(screen.getByText('Paragraph 1')).toBeDefined();
    expect(screen.getByText('Paragraph 2')).toBeDefined();
  });
});

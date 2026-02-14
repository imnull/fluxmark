/**
 * StreamingParser 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StreamingParser } from '../src/parser.js';
import type { Fragment, CodeBlockData, ImageData, ParagraphData } from '../src/types/index.js';

describe('StreamingParser', () => {
  let parser: StreamingParser;

  beforeEach(() => {
    parser = new StreamingParser();
  });

  // ===== 基础解析测试 =====

  describe('基础解析', () => {
    it('应该解析一级标题', () => {
      parser.appendChunk('# Hello World\n');
      const fragments = parser.finalize();

      expect(fragments).toHaveLength(1);
      expect(fragments[0].type).toBe('heading');
      expect(fragments[0].data).toEqual({ level: 1, content: 'Hello World' });
      expect(fragments[0].isComplete).toBe(true);
    });

    it('应该解析二级到六级标题', () => {
      const levels = [2, 3, 4, 5, 6];
      
      for (const level of levels) {
        parser.reset();
        parser.appendChunk(`${'#'.repeat(level)} Title\n`);
        const fragments = parser.finalize();
        
        expect(fragments[0].data).toEqual({ level, content: 'Title' });
      }
    });

    it('应该解析段落', () => {
      parser.appendChunk('This is a paragraph.\n\n');
      const fragments = parser.finalize();

      expect(fragments).toHaveLength(1);
      expect(fragments[0].type).toBe('paragraph');
      expect((fragments[0].data as ParagraphData).content).toBe('This is a paragraph.');
    });

    it('应该解析代码块', () => {
      parser.appendChunk('```typescript\nconst x = 1;\n```\n');
      const fragments = parser.finalize();

      expect(fragments).toHaveLength(1);
      expect(fragments[0].type).toBe('codeblock');
      
      const data = fragments[0].data as CodeBlockData;
      expect(data.lang).toBe('typescript');
      expect(data.code).toBe('const x = 1;');
    });

    it('应该解析多行段落', () => {
      parser.appendChunk('Line 1\nLine 2\nLine 3\n\n');
      const fragments = parser.finalize();

      expect(fragments).toHaveLength(1);
      expect(fragments[0].type).toBe('paragraph');
      expect(fragments[0].rawContent).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  // ===== Key 生成测试 =====

  describe('Key 生成', () => {
    it('相同内容应该生成相同 key', () => {
      parser.appendChunk('# Same Content\n');
      const key1 = parser.finalize()[0].key;

      parser.reset();
      parser.appendChunk('# Same Content\n');
      const key2 = parser.finalize()[0].key;

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^frag-/);
    });

    it('不同内容应该生成不同 key', () => {
      parser.appendChunk('# Content A\n');
      const key1 = parser.finalize()[0].key;

      parser.reset();
      parser.appendChunk('# Content B\n');
      const key2 = parser.finalize()[0].key;

      expect(key1).not.toBe(key2);
    });

    it('未完成分片应该生成临时 key', () => {
      parser.appendChunk('Incomplete paragraph...');
      const fragments = parser.getFragments();

      expect(fragments).toHaveLength(1);
      expect(fragments[0].isComplete).toBe(false);
      expect(fragments[0].key).toMatch(/^temp-/);
    });

    it('完成后 key 应该从临时转为稳定', () => {
      parser.appendChunk('Paragraph');
      const tempKey = parser.getFragments()[0].key;
      expect(tempKey).toMatch(/^temp-/);

      parser.appendChunk(' text\n\n');
      const finalKey = parser.finalize()[0].key;
      expect(finalKey).toMatch(/^frag-/);
    });
  });

  // ===== 流式输入测试 =====

  describe('流式输入', () => {
    it('应该支持增量输入', () => {
      parser.appendChunk('# Hel');
      let fragments = parser.getFragments();
      expect(fragments).toHaveLength(1);
      expect(fragments[0].isComplete).toBe(false);

      parser.appendChunk('lo\n');
      fragments = parser.getFragments();
      expect(fragments[0].isComplete).toBe(true);
      expect((fragments[0].data as { content: string }).content).toBe('Hello');
    });

    it('应该正确处理跨 chunk 的代码块', () => {
      parser.appendChunk('```js\nline1');
      let fragments = parser.getFragments();
      expect(fragments[0].type).toBe('codeblock');
      expect(fragments[0].isComplete).toBe(false);

      parser.appendChunk('\nline2\n```\n');
      fragments = parser.finalize();
      
      expect(fragments[0].isComplete).toBe(true);
      expect((fragments[0].data as CodeBlockData).code).toBe('line1\nline2');
    });

    it('应该保持已完成分片稳定', () => {
      parser.appendChunk('# Title\n\n');
      parser.appendChunk('First para\n\n');
      
      const key1 = parser.getFragments()[0].key;
      
      parser.appendChunk('Second para\n\n');
      const key2 = parser.getFragments()[0].key;
      
      expect(key1).toBe(key2);
    });
  });

  // ===== 图片分片测试 =====

  describe('图片分片', () => {
    it('应该将图片提取为单独分片', () => {
      parser.appendChunk('Text ![alt](image.jpg) more\n\n');
      const fragments = parser.finalize();

      // 应该拆分成：文本 + 图片 + 文本
      expect(fragments.length).toBeGreaterThanOrEqual(2);
      
      const imageFragment = fragments.find(f => f.type === 'image');
      expect(imageFragment).toBeDefined();
      
      const imageData = imageFragment!.data as ImageData;
      expect(imageData.alt).toBe('alt');
      expect(imageData.src).toBe('image.jpg');
    });

    it('图片应该有自己的 key', () => {
      parser.appendChunk('![img](url.jpg)\n\n');
      const fragments = parser.finalize();

      const imageFragment = fragments.find(f => f.type === 'image');
      expect(imageFragment).toBeDefined();
      expect(imageFragment!.key).toMatch(/^frag-/);
    });

    it('多张图片应该各自独立', () => {
      parser.appendChunk('![img1](1.jpg) text ![img2](2.jpg)\n\n');
      const fragments = parser.finalize();

      const images = fragments.filter(f => f.type === 'image');
      expect(images).toHaveLength(2);
      expect(images[0].key).not.toBe(images[1].key);
    });
  });

  // ===== 代码块行级分片测试 =====

  describe('代码块行级分片', () => {
    it('应该按行分片代码块', () => {
      parser.appendChunk('```js\nline1\nline2\nline3\n```\n');
      const fragments = parser.finalize();

      const data = fragments[0].data as CodeBlockData;
      expect(data.lines).toBeDefined();
      expect(data.lines).toHaveLength(3);
      expect(data.lines![0].content).toBe('line1');
      expect(data.lines![1].content).toBe('line2');
      expect(data.lines![2].content).toBe('line3');
    });

    it('所有行应该标记为完成', () => {
      parser.appendChunk('```js\na\nb\n```\n');
      const fragments = parser.finalize();

      const data = fragments[0].data as CodeBlockData;
      expect(data.lines!.every(l => l.isComplete)).toBe(true);
    });

    it('未完成代码块应该有行数据', () => {
      parser.appendChunk('```js\nline1\nline2');
      const fragments = parser.getFragments();

      const data = fragments[0].data as CodeBlockData;
      expect(data.lines).toBeDefined();
      expect(data.lines!.length).toBeGreaterThanOrEqual(1);
    });

    it('应该支持无语言标识的代码块', () => {
      parser.appendChunk('```\ncode\n```\n');
      const fragments = parser.finalize();

      const data = fragments[0].data as CodeBlockData;
      expect(data.lang).toBe('');
      expect(data.code).toBe('code');
    });
  });

  // ===== 边界情况测试 =====

  describe('边界情况', () => {
    it('应该处理空输入', () => {
      parser.appendChunk('');
      const fragments = parser.getFragments();
      expect(fragments).toHaveLength(0);
    });

    it('应该处理仅空行', () => {
      parser.appendChunk('\n\n\n');
      const fragments = parser.getFragments();
      expect(fragments).toHaveLength(0);
    });

    it('应该正确计算位置信息', () => {
      parser.appendChunk('# Title\n\n');
      parser.appendChunk('Paragraph\n');
      const fragments = parser.finalize();

      expect(fragments[0].position.start).toBe(0);
      expect(fragments[0].position.line).toBe(1);
      expect(fragments[1].position.line).toBe(3);
    });

    it('reset 应该清空状态', () => {
      parser.appendChunk('# Title\n');
      expect(parser.getFragments()).toHaveLength(1);

      parser.reset();
      expect(parser.getFragments()).toHaveLength(0);
      expect(parser.isComplete()).toBe(true);
    });

    it('finalize 应该完成当前分片', () => {
      parser.appendChunk('Incomplete');
      expect(parser.getFragments()[0].isComplete).toBe(false);

      parser.finalize();
      expect(parser.getFragments()[0].isComplete).toBe(true);
    });
  });

  // ===== 复杂场景测试 =====

  describe('复杂场景', () => {
    it('应该处理混合内容', () => {
      const markdown = `
# Title

Paragraph 1

\`\`\`js
const x = 1;
\`\`\`

- Item 1
- Item 2

> Quote

![img](test.jpg)
`;
      parser.appendChunk(markdown);
      const fragments = parser.finalize();

      expect(fragments.length).toBeGreaterThan(0);
      
      const types = fragments.map(f => f.type);
      expect(types).toContain('heading');
      expect(types).toContain('paragraph');
      expect(types).toContain('codeblock');
      expect(types).toContain('image');
    });

    it('所有完成的片段应该有稳定 key', () => {
      parser.appendChunk('# H1\n\nPara 1\n\n```code```\n\n');
      const fragments = parser.finalize();

      for (const frag of fragments) {
        expect(frag.isComplete).toBe(true);
        expect(frag.key).toMatch(/^frag-/);
      }
    });
  });
});

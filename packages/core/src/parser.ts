/**
 * 流式 Markdown 解析器
 * 
 * 核心特性：
 * - 增量解析：支持流式输入
 * - 块级分片：按 Markdown 块级元素分片
 * - 稳定 Key：基于内容 hash 生成 key
 * - 图片隔离：图片单独分片
 * - 细粒度分片：未完成代码块按行分片
 */

import { 
  Fragment, 
  FragmentType, 
  ParserOptions,
  FragmentData,
  HeadingData,
  ParagraphData,
  CodeBlockData,
  ImageData,
  BlockPattern,
  ParserState
} from './types/index.js';
import { generateFragmentKey } from './utils/hash.js';

// ===== 块级模式定义 =====

const BLOCK_PATTERNS: BlockPattern[] = [
  {
    type: 'codeblock',
    startPattern: /^```(\w*)/,
    endPattern: /^```$/,
    isSingleLine: false,
    canContainImages: false,
  },
  {
    type: 'heading',
    startPattern: /^(#{1,6})\s+(.+)$/,
    isSingleLine: true,
    canContainImages: true,
  },
  {
    type: 'list',
    startPattern: /^([\s]*)([-*+]|\d+\.)\s/,
    isSingleLine: false,
    canContainImages: true,
  },
  {
    type: 'blockquote',
    startPattern: /^>(\s*)/,
    isSingleLine: false,
    canContainImages: true,
  },
  {
    type: 'thematicBreak',
    startPattern: /^(-{3,}|\*{3,}|_{3,})\s*$/,
    isSingleLine: true,
    canContainImages: false,
  },
  {
    type: 'paragraph',
    startPattern: /^(?!\s*$)(?![#>`\-|])/,
    isSingleLine: false,
    canContainImages: true,
  },
];

// 图片匹配正则
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g;

export class StreamingParser {
  private state: ParserState;
  private options: Required<ParserOptions>;

  constructor(options: ParserOptions = {}) {
    this.options = {
      incompleteCodeStrategy: 'line',
      hashAlgorithm: 'murmur3',
      preloadImages: false,
      ...options,
    };

    this.state = {
      buffer: '',
      fragments: [],
      currentFragment: null,
      position: 0,
      line: 1,
      column: 1,
      lastProcessedLineIndex: 0,
    };
  }

  // ===== 公共方法 =====

  /**
   * 追加新的文本 chunk
   */
  appendChunk(chunk: string): void {
    if (!chunk) return;
    this.state.buffer += chunk;
    this.parseIncremental();
  }

  /**
   * 获取当前所有分片
   */
  getFragments(): ReadonlyArray<Fragment> {
    const result = [...this.state.fragments];
    if (this.state.currentFragment) {
      result.push(this.state.currentFragment);
    }
    return result;
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.state = {
      buffer: '',
      fragments: [],
      currentFragment: null,
      position: 0,
      line: 1,
      column: 1,
      lastProcessedLineIndex: 0,
    };
  }

  /**
   * 结束流，标记所有未完成分片为完成
   */
  finalize(): ReadonlyArray<Fragment> {
    // 先完成当前分片
    if (this.state.currentFragment) {
      this.state.currentFragment.isComplete = true;
      this.finalizeCurrentFragment();
    }
    
    // 重新生成所有已完成分片的 key（确保是稳定 key）
    for (const frag of this.state.fragments) {
      if (frag.isComplete && frag.key.startsWith('temp-')) {
        frag.key = generateFragmentKey(
          frag.rawContent,
          this.state.fragments.indexOf(frag),
          true,
          this.options.hashAlgorithm
        );
      }
    }
    
    return this.getFragments();
  }

  /**
   * 检查是否全部完成
   */
  isComplete(): boolean {
    if (this.state.currentFragment) return false;
    return this.state.fragments.every(f => f.isComplete);
  }

  /**
   * 获取缓冲区长度
   */
  getBufferLength(): number {
    return this.state.buffer.length;
  }

  // ===== 私有方法：解析逻辑 =====

  private parseIncremental(): void {
    // 简单策略：重新解析整个缓冲区
    // 对于流式场景，内容不会太长，重新解析是可行的
    const lines = this.state.buffer.split('\n');
    
    // 确定最后完整行的索引
    const bufferEndsWithNewline = this.state.buffer.endsWith('\n');
    const lastCompleteIndex = bufferEndsWithNewline 
      ? lines.length - 1
      : lines.length - 2;
    
    // 重置解析状态
    this.state.fragments = [];
    this.state.currentFragment = null;
    this.state.position = 0;
    this.state.line = 1;
    this.state.column = 1;
    
    // 重新解析所有行
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isCompleteLine = i <= lastCompleteIndex;
      
      if (this.state.currentFragment) {
        // 如果有当前分片，尝试继续
        if (this.shouldContinueFragment(this.state.currentFragment, line, isCompleteLine)) {
          this.continueFragment(line, !isCompleteLine);
        } else {
          // 需要结束当前分片
          // 对于段落/引用等，空行表示结束
          if (!line.trim() && isCompleteLine) {
            (this.state.currentFragment as Fragment).isComplete = true;
          }
          // 完成当前分片，开始新的
          this.finalizeCurrentFragment();
          if (line.trim()) {
            this.startNewFragmentFromLine(line, !isCompleteLine);
          }
        }
      } else {
        this.startNewFragmentFromLine(line, !isCompleteLine);
      }
    }
  }
  
  private shouldContinueFragment(fragment: Fragment, line: string, isCompleteLine: boolean): boolean {
    // 单行块不应该继续
    if (fragment.type === 'heading' || fragment.type === 'thematicBreak') {
      return false;
    }
    
    // 代码块遇到 ``` 结束
    if (fragment.type === 'codeblock') {
      if (line === '```' && isCompleteLine) {
        return true; // 会处理结束
      }
      return true;
    }
    
    // 其他块：空行表示结束
    if (!line.trim() && isCompleteLine) {
      return false;
    }
    
    return true;
  }
  
  private startNewFragmentFromLine(line: string, isIncomplete: boolean): void {
    // 跳过空行（但代码块内的空行需要特殊处理）
    if (!line.trim()) {
      // 如果有当前代码块，保留空行
      if (this.state.currentFragment?.type === 'codeblock') {
        this.continueFragment(line, isIncomplete);
        return;
      }
      this.advancePosition(line);
      if (!isIncomplete) {
        this.advancePosition('\n');
      }
      return;
    }
    
    // 尝试识别块类型
    const pattern = BLOCK_PATTERNS.find(p => p.startPattern.test(line));
    const type = pattern?.type || 'paragraph';
    
    // 如果是单行块且是完整行，直接完成
    const isSingleLine = pattern?.isSingleLine ?? false;
    const shouldComplete = isSingleLine && !isIncomplete;
    
    const data = this.createInitialData(type, line);
    const fragment = this.createFragment({
      type,
      rawContent: line,
      isComplete: shouldComplete,
      data,
    });
    
    if (shouldComplete) {
      // 立即确认
      if (type === 'paragraph' || type === 'blockquote') {
        const imageFragments = this.splitImages(fragment);
        const hasImageFragments = imageFragments.some(f => f.type === 'image');
        if (hasImageFragments) {
          this.state.fragments.push(...imageFragments);
        } else {
          this.state.fragments.push(fragment);
        }
      } else {
        this.state.fragments.push(fragment);
      }
      this.advancePosition(line);
      this.advancePosition('\n');
    } else {
      // 作为当前分片
      this.state.currentFragment = fragment;
      this.advancePosition(line);
      if (!isIncomplete) {
        this.advancePosition('\n');
      }
    }
  }



  private continueFragment(line: string, isIncomplete: boolean): void {
    const current = this.state.currentFragment!;
    

    
    switch (current.type) {
      case 'codeblock':
        this.continueCodeBlock(line, isIncomplete);
        break;
      case 'list':
        this.continueList(line, isIncomplete);
        break;
      case 'blockquote':
        this.continueBlockquote(line, isIncomplete);
        break;
      default:
        this.continueDefaultBlock(line, isIncomplete);
    }
  }





  // ===== CodeBlock 处理 =====

  private continueCodeBlock(line: string, isIncomplete: boolean): void {
    const current = this.state.currentFragment!;
    
    // 检查是否结束（``` 且不是未完成的最后一行）
    if (line === '```' && !isIncomplete) {
      current.rawContent += '\n' + line;
      current.isComplete = true;
      this.finalizeCodeBlock();
      this.finalizeCurrentFragment();
      this.advancePosition('\n' + line);
      return;
    }

    // 继续累积代码
    // 如果 rawContent 不以换行结尾，添加换行
    if (!current.rawContent.endsWith('\n')) {
      current.rawContent += '\n';
    }
    current.rawContent += line;
    
    this.updateCodeBlockData(line, isIncomplete);
    this.advancePosition('\n' + line);
  }

  private updateCodeBlockData(line: string, isIncomplete: boolean): void {
    const data = this.state.currentFragment!.data as CodeBlockData;
    data.code += (data.code ? '\n' : '') + line;

    // 按行分片策略
    if (this.options.incompleteCodeStrategy === 'line') {
      if (!data.lines) data.lines = [];
      
      const lineNumber = data.lines.length + 1;
      const isComplete = !isIncomplete;
      
      data.lines.push({
        content: line,
        lineNumber,
        isComplete,
      });
    }
  }

  private finalizeCodeBlock(): void {
    const current = this.state.currentFragment!;
    const data = current.data as CodeBlockData;
    
    // rawContent 格式: ```lang\ncode\nline2\n```
    const lines = current.rawContent.split('\n');
    
    // 解析语言（从第一行）
    const langMatch = lines[0].match(/^```(\w*)/);
    data.lang = langMatch?.[1] || '';
    
    // 提取代码（去掉第一行和最后一行）
    if (lines.length >= 2 && lines[lines.length - 1] === '```') {
      // 有闭合围栏
      const codeLines = lines.slice(1, -1);
      data.code = codeLines.join('\n');
    } else {
      // 无闭合围栏（流式中）
      const codeLines = lines.slice(1);
      data.code = codeLines.join('\n');
    }
    
    // 更新 lines 数据
    if (data.lines) {
      // 移除围栏行
      const lastLine = data.lines[data.lines.length - 1];
      if (lastLine && lastLine.content === '```') {
        data.lines.pop();
      }
      // 标记所有行为完成
      data.lines.forEach(line => {
        line.isComplete = true;
      });
    }
  }

  // ===== List 处理 =====

  private continueList(line: string, isIncomplete: boolean): void {
    // 简化实现：空行结束列表
    if (!line.trim() && !isIncomplete) {
      this.state.currentFragment!.isComplete = true;
      this.finalizeCurrentFragment();
      this.advancePosition('\n');
      return;
    }

    this.state.currentFragment!.rawContent += '\n' + line;
    this.advancePosition('\n');
    this.advancePosition(line);
  }

  // ===== Blockquote 处理 =====

  private continueBlockquote(line: string, isIncomplete: boolean): void {
    // 简化实现：空行结束引用
    if (!line.trim() && !isIncomplete) {
      this.state.currentFragment!.isComplete = true;
      this.finalizeCurrentFragment();
      this.advancePosition('\n');
      return;
    }

    this.state.currentFragment!.rawContent += '\n' + line;
    this.advancePosition('\n');
    this.advancePosition(line);
  }

  // ===== 默认块处理 =====

  private continueDefaultBlock(line: string, isIncomplete: boolean): void {
    // 空行且不是未完成的最后一行，表示块结束
    if (!line.trim() && !isIncomplete) {
      this.state.currentFragment!.isComplete = true;
      this.finalizeCurrentFragment();
      this.advancePosition('\n');
      return;
    }

    this.state.currentFragment!.rawContent += '\n' + line;
    this.advancePosition('\n');
    this.advancePosition(line);
  }

  // ===== 分片最终化 =====

  private finalizeCurrentFragment(): void {
    if (!this.state.currentFragment) return;

    const fragment = this.state.currentFragment;
    
    // 更新位置（如果不正确）
    if (fragment.position.end === fragment.position.start) {
      fragment.position.end = this.state.position;
    }
    
    // 如果刚变为完成状态，重新生成稳定 key
    if (fragment.isComplete && fragment.key.startsWith('temp-')) {
      fragment.key = generateFragmentKey(
        fragment.rawContent,
        this.state.fragments.length,
        true,
        this.options.hashAlgorithm
      );
    }
    
    // 处理图片分片
    if (fragment.type === 'paragraph' || fragment.type === 'blockquote') {
      const imageFragments = this.splitImages(fragment);
      // 如果 splitImages 返回了不同的分片（包含图片），使用新的
      const hasImageFragments = imageFragments.some(f => f.type === 'image');
      if (hasImageFragments) {
        this.state.fragments.push(...imageFragments);
      } else {
        this.state.fragments.push(fragment);
      }
    } else {
      this.state.fragments.push(fragment);
    }

    this.state.currentFragment = null;
  }

  // ===== 图片处理 =====

  private splitImages(fragment: Fragment): Fragment[] {
    const content = fragment.rawContent;
    const parts: { type: 'text' | 'image'; content: string; data?: ImageData }[] = [];
    
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    IMAGE_REGEX.lastIndex = 0;
    while ((match = IMAGE_REGEX.exec(content)) !== null) {
      // 添加图片前的文本
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
        });
      }
      
      // 添加图片
      parts.push({
        type: 'image',
        content: match[0],
        data: {
          alt: match[1],
          src: match[2],
          title: match[3],
        },
      });
      
      lastIndex = match.index + match[0].length;
    }

    // 添加剩余文本
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex),
      });
    }

    // 如果没有图片，返回原分片
    const hasImages = parts.some(p => p.type === 'image');
    if (!hasImages) {
      return [fragment];
    }

    // 过滤掉空文本段落，转换为 Fragment 数组
    return parts
      .filter(part => part.type === 'image' || part.content.trim())
      .map((part, index) => {
        const isImage = part.type === 'image';
        return this.createFragment({
          type: isImage ? 'image' : fragment.type,
          rawContent: part.content,
          isComplete: fragment.isComplete,
          data: isImage 
            ? part.data! 
            : { content: part.content, hasInlineImages: false },
        }, index);
      });
  }

  // ===== 辅助方法 =====

  private createFragment(
    partial: Omit<Fragment, 'key' | 'position' | 'meta'>,
    index?: number
  ): Fragment {
    const now = Date.now();
    const fragIndex = index ?? this.state.fragments.length;
    
    const key = generateFragmentKey(
      partial.rawContent,
      fragIndex,
      partial.isComplete,
      this.options.hashAlgorithm
    );

    return {
      ...partial,
      key,
      position: {
        start: this.state.position,
        end: this.state.position + partial.rawContent.length,
        line: this.state.line,
        column: this.state.column,
      },
      meta: {
        createdAt: now,
        updatedAt: now,
        updateCount: 0,
        fromStreaming: true,
      },
    };
  }

  private createInitialData(type: FragmentType, content: string): FragmentData {
    switch (type) {
      case 'heading': {
        const match = content.match(/^(#{1,6})\s+(.+)$/);
        return {
          level: match?.[1].length || 1,
          content: match?.[2] || content,
        } as HeadingData;
      }
      case 'codeblock': {
        const match = content.match(/^```(\w*)/);
        return {
          lang: match?.[1] || '',
          code: '',
          lines: [],
        } as CodeBlockData;
      }
      case 'paragraph':
        return {
          content,
          hasInlineImages: IMAGE_REGEX.test(content),
        } as ParagraphData;
      default:
        return { content, level: 1 };
    }
  }

  private advancePosition(text: string): void {
    for (const char of text) {
      this.state.position++;
      if (char === '\n') {
        this.state.line++;
        this.state.column = 1;
      } else {
        this.state.column++;
      }
    }
  }
}

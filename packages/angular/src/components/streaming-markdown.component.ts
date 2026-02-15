/**
 * StreamingMarkdown 主组件
 *
 * 流式 Markdown 渲染的 Angular 组件
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  TrackByFunction,
} from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { StreamingParser, type Fragment, type ParserOptions } from '@streaming-markdown/core';
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
} from './fragment-renderers.js';

@Component({
  selector: 'streaming-markdown',
  template: `
    <div [ngClass]="containerClasses">
      <ng-container *ngFor="let fragment of fragments; trackBy: trackByFragment">
        @switch (fragment.type) {
          @case ('heading') {
            <md-heading
              [fragment]="fragment"
              [isStreaming]="isStreaming"
              [level]="getHeadingLevel(fragment)"
              [content]="getHeadingContent(fragment)"
            />
          }
          @case ('paragraph') {
            <md-paragraph
              [fragment]="fragment"
              [isStreaming]="isStreaming"
              [content]="getParagraphContent(fragment)"
            />
          }
          @case ('codeblock') {
            <md-codeblock
              [fragment]="fragment"
              [isStreaming]="isStreaming"
              [lang]="getCodeLang(fragment)"
              [code]="getCodeContent(fragment)"
              [lines]="getCodeLines(fragment)"
            />
          }
          @case ('list') {
            <md-list
              [fragment]="fragment"
              [isStreaming]="isStreaming"
              [ordered]="isOrderedList(fragment)"
              [items]="getListItems(fragment)"
            />
          }
          @case ('blockquote') {
            <md-blockquote
              [fragment]="fragment"
              [isStreaming]="isStreaming"
              [content]="getBlockquoteContent(fragment)"
              [level]="getBlockquoteLevel(fragment)"
            />
          }
          @case ('image') {
            <md-image
              [fragment]="fragment"
              [isStreaming]="isStreaming"
              [src]="getImageSrc(fragment)"
              [alt]="getImageAlt(fragment)"
              [title]="getImageTitle(fragment)"
              [href]="getImageHref(fragment)"
            />
          }
          @case ('thematicBreak') {
            <md-thematic-break
              [fragment]="fragment"
              [isStreaming]="isStreaming"
            />
          }
          @case ('incomplete') {
            <md-incomplete
              [fragment]="fragment"
              [isStreaming]="isStreaming"
              [partialType]="getIncompletePartialType(fragment)"
              [accumulatedContent]="getIncompleteContent(fragment)"
            />
          }
          @default {
            <div class="md-unknown">{{ fragment.rawContent }}</div>
          }
        }
      </ng-container>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgClass,
    NgFor,
    NgIf,
    HeadingRenderer,
    ParagraphRenderer,
    CodeBlockRenderer,
    ListRenderer,
    ListItemRenderer,
    BlockquoteRenderer,
    ImageRenderer,
    ThematicBreakRenderer,
    IncompleteRenderer,
  ],
})
export class StreamingMarkdownComponent implements OnChanges, OnInit, OnDestroy {
  @Input() content = '';
  @Input() options?: ParserOptions;
  @Input() class = '';

  @Output() complete = new EventEmitter<void>();
  @Output() fragmentUpdate = new EventEmitter<Fragment[]>();

  fragments: Fragment[] = [];
  isStreaming = false;
  isComplete = false;

  private parser: StreamingParser | null = null;
  private lastLength = 0;
  private streamingTimer: ReturnType<typeof setTimeout> | null = null;
  private previousIsComplete = false;

  ngOnInit(): void {
    this.parser = new StreamingParser(this.options);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content']) {
      this.processContent(this.content);
    }

    if (changes['options']) {
      // 重新初始化解析器
      this.parser = new StreamingParser(this.options);
      this.lastLength = 0;
      this.fragments = [];
      this.isComplete = false;
      this.previousIsComplete = false;
      if (this.content) {
        this.processContent(this.content);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.streamingTimer) {
      clearTimeout(this.streamingTimer);
    }
  }

  private processContent(content: string): void {
    if (!this.parser) return;

    const currentLength = content.length;
    const prevLength = this.lastLength;

    if (
      currentLength >= prevLength &&
      content.startsWith(content.slice(0, prevLength))
    ) {
      // 追加模式
      const newChunk = content.slice(prevLength);

      if (newChunk) {
        this.isStreaming = true;
        this.parser.appendChunk(newChunk);
        this.lastLength = currentLength;

        // 防抖
        if (this.streamingTimer) {
          clearTimeout(this.streamingTimer);
        }
        this.streamingTimer = setTimeout(() => {
          this.isStreaming = false;
        }, 100);
      }
    } else {
      // 重置模式
      this.parser.reset();
      this.lastLength = 0;

      if (content) {
        this.parser.appendChunk(content);
        this.lastLength = content.length;
      }
    }

    this.fragments = [...this.parser.getFragments()];
    this.isComplete = this.fragments.every((f) => f.isComplete);

    // 触发事件
    this.fragmentUpdate.emit(this.fragments);

    if (this.isComplete && !this.previousIsComplete) {
      this.complete.emit();
    }
    this.previousIsComplete = this.isComplete;
  }

  // trackBy 函数
  trackByFragment: TrackByFunction<Fragment> = (_index, fragment) => fragment.key;

  // 获取容器类
  get containerClasses(): string[] {
    return [
      'streaming-markdown',
      this.isStreaming ? 'md-streaming' : 'md-complete',
      this.class,
    ].filter(Boolean);
  }

  // Fragment 数据提取方法
  getHeadingLevel(fragment: Fragment): number {
    const data = fragment.data as { level: number };
    return data?.level || 1;
  }

  getHeadingContent(fragment: Fragment): string {
    const data = fragment.data as { content: string };
    return data?.content || '';
  }

  getParagraphContent(fragment: Fragment): string {
    const data = fragment.data as { content: string };
    return data?.content || '';
  }

  getCodeLang(fragment: Fragment): string {
    const data = fragment.data as { lang: string };
    return data?.lang || '';
  }

  getCodeContent(fragment: Fragment): string {
    const data = fragment.data as { code: string };
    return data?.code || '';
  }

  getCodeLines(fragment: Fragment): { content: string; lineNumber: number; isComplete: boolean }[] {
    const data = fragment.data as { lines?: { content: string; lineNumber: number; isComplete: boolean }[] };
    return data?.lines || [];
  }

  isOrderedList(fragment: Fragment): boolean {
    const data = fragment.data as { ordered: boolean };
    return data?.ordered || false;
  }

  getListItems(fragment: Fragment): { content: string; checked?: boolean; level: number }[] {
    const data = fragment.data as { items: { content: string; checked?: boolean; level: number }[] };
    return data?.items || [];
  }

  getBlockquoteContent(fragment: Fragment): string {
    const data = fragment.data as { content: string };
    return data?.content || '';
  }

  getBlockquoteLevel(fragment: Fragment): number {
    const data = fragment.data as { level: number };
    return data?.level || 1;
  }

  getImageSrc(fragment: Fragment): string {
    const data = fragment.data as { src: string };
    return data?.src || '';
  }

  getImageAlt(fragment: Fragment): string {
    const data = fragment.data as { alt: string };
    return data?.alt || '';
  }

  getImageTitle(fragment: Fragment): string | undefined {
    const data = fragment.data as { title?: string };
    return data?.title;
  }

  getImageHref(fragment: Fragment): string | undefined {
    const data = fragment.data as { href?: string };
    return data?.href;
  }

  getIncompletePartialType(fragment: Fragment): string {
    const data = fragment.data as { partialType: string };
    return data?.partialType || '';
  }

  getIncompleteContent(fragment: Fragment): string {
    const data = fragment.data as { accumulatedContent: string };
    return data?.accumulatedContent || '';
  }
}

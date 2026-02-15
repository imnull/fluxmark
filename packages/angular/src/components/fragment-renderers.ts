/**
 * Fragment 渲染器组件
 *
 * 各类型分片的 Angular 渲染实现
 */

import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type { Fragment } from '@streaming-markdown/core';
import type {
  CodeLine,
  ListItem,
  HighlightFunction,
} from '../types/index.js';

/**
 * 简单的行内标记解析
 */
function processInlineMarkdown(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

// ===== Heading 渲染器 =====

@Component({
  selector: 'md-heading',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class HeadingRenderer implements OnChanges {
  @Input() fragment!: Fragment;
  @Input() isStreaming = false;
  @Input() level = 1;
  @Input() content = '';

  headingTag = 'h1';
  headingClass = 'md-heading md-h1';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['level']) {
      this.headingTag = `h${this.level}`;
      this.headingClass = `md-heading md-h${this.level}`;
    }
  }
}

// ===== Paragraph 渲染器 =====

@Component({
  selector: 'md-paragraph',
  template: `
    <p class="md-paragraph" [innerHTML]="processedContent"></p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ParagraphRenderer implements OnChanges {
  @Input() fragment!: Fragment;
  @Input() isStreaming = false;
  @Input() content = '';
  @Input() hasInlineImages = false;

  processedContent: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content']) {
      const processed = processInlineMarkdown(this.content);
      this.processedContent = this.sanitizer.bypassSecurityTrustHtml(processed);
    }
  }
}

// ===== CodeBlock 渲染器 =====

@Component({
  selector: 'md-codeblock',
  template: `
    @if (lines && lines.length > 0 && !fragment.isComplete) {
      <pre class="md-codeblock md-codeblock-streaming">
        <code [class]="langClass">
          @for (line of lines; track line.lineNumber) {
            <div
              [class]="getLineClass(line)"
              [attr.data-line-number]="line.lineNumber"
            >
              {{ line.content }}
            </div>
          }
        </code>
      </pre>
    } @else {
      <pre class="md-codeblock">
        <code [class]="langClass" [innerHTML]="highlightedCode">
          @if (!highlightedCode) {
            {{ code }}
          }
        </code>
        @if (isHighlighting) {
          <span class="md-highlighting-indicator"></span>
        }
      </pre>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class CodeBlockRenderer implements OnChanges {
  @Input() fragment!: Fragment;
  @Input() isStreaming = false;
  @Input() lang = '';
  @Input() code = '';
  @Input() lines: CodeLine[] = [];
  @Input() highlight?: HighlightFunction;

  highlightedCode: SafeHtml = '';
  isHighlighting = false;
  langClass = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lang']) {
      this.langClass = this.lang ? `language-${this.lang}` : '';
    }

    if (
      changes['fragment'] ||
      changes['code'] ||
      changes['lang'] ||
      changes['highlight']
    ) {
      if (this.fragment.isComplete && this.highlight && this.code) {
        this.isHighlighting = true;
        Promise.resolve(this.highlight(this.code, this.lang))
          .then((html) => {
            this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
            this.isHighlighting = false;
          })
          .catch(() => {
            this.isHighlighting = false;
          });
      }
    }
  }

  // Workaround for template access
  get highlightedHtml(): SafeHtml {
    return this.highlightedCode;
  }
  set highlightedHtml(value: SafeHtml) {
    this.highlightedCode = value;
  }

  getLineClass(line: CodeLine): string {
    return `md-code-line ${line.isComplete ? 'md-complete' : 'md-incomplete'}`;
  }
}

// ===== List 渲染器 =====

@Component({
  selector: 'md-list',
  template: `
    <ul *ngIf="!ordered" [class]="listClass">
      <ng-content></ng-content>
    </ul>
    <ol *ngIf="ordered" [class]="listClass">
      <ng-content></ng-content>
    </ol>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgIf],
})
export class ListRenderer {
  @Input() fragment!: Fragment;
  @Input() isStreaming = false;
  @Input() ordered = false;
  @Input() items: ListItem[] = [];

  get listClass(): string {
    return `md-list ${this.ordered ? 'md-ordered-list' : 'md-unordered-list'}`;
  }
}

// NgIf for standalone
import { NgIf } from '@angular/common';

// ===== ListItem 渲染器 =====

@Component({
  selector: 'md-list-item',
  template: `
    <li [class]="itemClass">
      @if (item.checked !== undefined) {
        <input
          type="checkbox"
          [checked]="item.checked"
          readonly
          class="md-task-checkbox"
        />
      }
      {{ item.content }}
    </li>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ListItemRenderer {
  @Input() fragment!: Fragment;
  @Input() isStreaming = false;
  @Input() item!: ListItem;
  @Input() index = 0;

  get itemClass(): string {
    return `md-list-item ${this.item.checked !== undefined ? 'md-task-item' : ''}`;
  }
}

// ===== Blockquote 渲染器 =====

@Component({
  selector: 'md-blockquote',
  template: `
    <blockquote [class]="blockquoteClass">
      <p>{{ content }}</p>
    </blockquote>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class BlockquoteRenderer {
  @Input() fragment!: Fragment;
  @Input() isStreaming = false;
  @Input() content = '';
  @Input() level = 1;

  get blockquoteClass(): string {
    return `md-blockquote md-blockquote-level-${this.level}`;
  }
}

// ===== Image 渲染器 =====

@Component({
  selector: 'md-image',
  template: `
    @if (hasError) {
      <div [style]="errorStyles">
        <div [style]="errorIconStyle">🖼️</div>
        <div [style]="errorTextStyle">{{ alt || '图片加载失败' }}</div>
        <div [style]="errorUrlStyle">{{ src?.slice(0, 50) }}...</div>
      </div>
    } @else {
      <img
        [src]="src"
        [alt]="alt"
        [title]="title"
        loading="lazy"
        [class]="imageClass"
        [style]="imageStyle"
        (load)="onLoad()"
        (error)="onError()"
      />
    }

    @if (href) {
      <a [href]="href" target="_blank" rel="noopener noreferrer" class="md-image-link" [style]="linkStyle">
        <figure [class]="figureClass">
          <ng-content></ng-content>
          @if (alt) {
            <figcaption class="md-image-caption">{{ alt }}</figcaption>
          }
        </figure>
      </a>
    } @else {
      <figure [class]="figureClass">
        <ng-content></ng-content>
        @if (alt) {
          <figcaption class="md-image-caption">{{ alt }}</figcaption>
        }
      </figure>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ImageRenderer implements OnChanges {
  @Input() fragment!: Fragment;
  @Input() isStreaming = false;
  @Input() src = '';
  @Input() alt = '';
  @Input() title?: string;
  @Input() href?: string;

  isLoaded = false;
  hasError = false;

  // 样式对象
  errorStyles = {
    padding: '20px',
    background: '#f5f5f5',
    border: '1px dashed #ccc',
    borderRadius: '4px',
    textAlign: 'center',
    color: '#666',
  };

  errorIconStyle = {
    fontSize: '24px',
    marginBottom: '8px',
  };

  errorTextStyle = {
    fontSize: '14px',
  };

  errorUrlStyle = {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
  };

  get imageClass(): string {
    return `md-image ${this.isLoaded ? 'md-loaded' : 'md-loading'}`;
  }

  get imageStyle(): Record<string, string> {
    return {
      opacity: this.isLoaded ? '1' : '0.5',
      transition: 'opacity 0.3s ease',
      minHeight: '100px',
      background: '#f0f0f0',
    };
  }

  get figureClass(): string {
    return `md-image-wrapper ${this.hasError ? 'md-image-error' : ''}`;
  }

  linkStyle = { textDecoration: 'none' };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src']) {
      this.isLoaded = false;
      this.hasError = false;
      this.preloadImage();
    }
  }

  private preloadImage(): void {
    const img = new Image();
    img.src = this.src;
    img.onload = () => {
      this.isLoaded = true;
    };
    img.onerror = () => {
      this.hasError = true;
    };
  }

  onLoad(): void {
    this.isLoaded = true;
  }

  onError(): void {
    this.hasError = true;
  }
}

// ===== ThematicBreak 渲染器 =====

@Component({
  selector: 'md-thematic-break',
  template: `<hr class="md-hr" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ThematicBreakRenderer {
  @Input() fragment!: Fragment;
  @Input() isStreaming = false;
}

// ===== Incomplete 渲染器 =====

@Component({
  selector: 'md-incomplete',
  template: `
    <div class="md-incomplete md-pending">
      @if (partialType === 'paragraph') {
        <p class="md-paragraph md-incomplete-content">
          {{ accumulatedContent }}<span class="md-cursor">▋</span>
        </p>
      } @else if (partialType === 'codeblock') {
        <pre class="md-codeblock md-incomplete-content">
          <code>{{ accumulatedContent }}</code>
        </pre>
      } @else {
        <div class="md-raw md-incomplete-content">
          {{ accumulatedContent }}<span class="md-cursor">▋</span>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class IncompleteRenderer {
  @Input() fragment!: Fragment;
  @Input() isStreaming = false;
  @Input() partialType = '';
  @Input() accumulatedContent = '';
}

// ===== 导出所有渲染器 =====
export const FRAGMENT_RENDERERS = [
  HeadingRenderer,
  ParagraphRenderer,
  CodeBlockRenderer,
  ListRenderer,
  ListItemRenderer,
  BlockquoteRenderer,
  ImageRenderer,
  ThematicBreakRenderer,
  IncompleteRenderer,
];

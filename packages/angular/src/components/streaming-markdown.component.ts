/**
 * StreamingMarkdown 主组件
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StreamingParser, type Fragment, type ParserOptions } from '@streaming-markdown/core';

@Component({
  selector: 'streaming-markdown',
  template: `
    <div class="streaming-markdown" [class.md-streaming]="isStreaming" [class.md-complete]="!isStreaming" [class]="class">
      <ng-container *ngFor="let fragment of fragments; trackBy: trackByKey">

        <!-- Heading -->
        <ng-container *ngIf="fragment.type === 'heading'">
          <h1 *ngIf="getLevel(fragment) === 1" class="md-heading md-h1">{{ getContent(fragment) }}</h1>
          <h2 *ngIf="getLevel(fragment) === 2" class="md-heading md-h2">{{ getContent(fragment) }}</h2>
          <h3 *ngIf="getLevel(fragment) === 3" class="md-heading md-h3">{{ getContent(fragment) }}</h3>
          <h4 *ngIf="getLevel(fragment) === 4" class="md-heading md-h4">{{ getContent(fragment) }}</h4>
          <h5 *ngIf="getLevel(fragment) === 5" class="md-heading md-h5">{{ getContent(fragment) }}</h5>
          <h6 *ngIf="getLevel(fragment) === 6" class="md-heading md-h6">{{ getContent(fragment) }}</h6>
        </ng-container>

        <!-- Paragraph -->
        <p *ngIf="fragment.type === 'paragraph'" class="md-paragraph" [innerHTML]="getSafeHtml(fragment)"></p>

        <!-- CodeBlock -->
        <pre *ngIf="fragment.type === 'codeblock'" class="md-codeblock">
          <code *ngIf="getLang(fragment)" class="language-{{ getLang(fragment) }}">{{ getCode(fragment) }}</code>
          <code *ngIf="!getLang(fragment)">{{ getCode(fragment) }}</code>
        </pre>

        <!-- List -->
        <ng-container *ngIf="fragment.type === 'list'">
          <ul *ngIf="!isOrdered(fragment)" class="md-list md-unordered-list">
            <li *ngFor="let item of getItems(fragment)" class="md-list-item" [class.md-task-item]="item.checked !== undefined">
              <input *ngIf="item.checked !== undefined" type="checkbox" [checked]="item.checked" readonly class="md-task-checkbox" />
              {{ item.content }}
            </li>
          </ul>
          <ol *ngIf="isOrdered(fragment)" class="md-list md-ordered-list">
            <li *ngFor="let item of getItems(fragment)" class="md-list-item" [class.md-task-item]="item.checked !== undefined">
              <input *ngIf="item.checked !== undefined" type="checkbox" [checked]="item.checked" readonly class="md-task-checkbox" />
              {{ item.content }}
            </li>
          </ol>
        </ng-container>

        <!-- Blockquote -->
        <blockquote *ngIf="fragment.type === 'blockquote'" class="md-blockquote" [class]="'md-blockquote-level-' + getLevel(fragment)">
          <p>{{ getContent(fragment) }}</p>
        </blockquote>

        <!-- Image -->
        <figure *ngIf="fragment.type === 'image'" class="md-image-wrapper">
          <a *ngIf="getImageHref(fragment)" [href]="getImageHref(fragment)" target="_blank" rel="noopener noreferrer" class="md-image-link">
            <img [src]="getImageSrc(fragment)" [alt]="getImageAlt(fragment)" [title]="getImageTitle(fragment)" loading="lazy" class="md-image" />
          </a>
          <img *ngIf="!getImageHref(fragment)" [src]="getImageSrc(fragment)" [alt]="getImageAlt(fragment)" [title]="getImageTitle(fragment)" loading="lazy" class="md-image" />
          <figcaption *ngIf="getImageAlt(fragment)" class="md-image-caption">{{ getImageAlt(fragment) }}</figcaption>
        </figure>

        <!-- ThematicBreak -->
        <hr *ngIf="fragment.type === 'thematicBreak'" class="md-hr" />

        <!-- Incomplete (streaming) -->
        <div *ngIf="fragment.type === 'incomplete'" class="md-incomplete md-pending">
          <p *ngIf="getPartialType(fragment) === 'paragraph'" class="md-paragraph md-incomplete-content">
            {{ getAccumulatedContent(fragment) }}<span class="md-cursor">▋</span>
          </p>
          <pre *ngIf="getPartialType(fragment) === 'codeblock'" class="md-codeblock md-incomplete-content">
            <code>{{ getAccumulatedContent(fragment) }}</code>
          </pre>
          <div *ngIf="getPartialType(fragment) !== 'paragraph' && getPartialType(fragment) !== 'codeblock'" class="md-raw md-incomplete-content">
            {{ getAccumulatedContent(fragment) }}<span class="md-cursor">▋</span>
          </div>
        </div>

      </ng-container>
    </div>
  `,
  styles: [`:host { display: block; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgFor, NgIf],
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
  private safeHtmlCache = new Map<string, SafeHtml>();

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.parser = new StreamingParser(this.options);
  }

  ngOnChanges(): void {
    this.processContent(this.content);
  }

  ngOnDestroy(): void {
    if (this.streamingTimer) {
      clearTimeout(this.streamingTimer);
    }
  }

  private processContent(content: string): void {
    if (!this.parser) {
      this.parser = new StreamingParser(this.options);
    }

    const currentLength = content.length;
    const prevLength = this.lastLength;

    if (currentLength >= prevLength && content.startsWith(content.slice(0, prevLength))) {
      const newChunk = content.slice(prevLength);
      if (newChunk) {
        this.isStreaming = true;
        this.parser.appendChunk(newChunk);
        this.lastLength = currentLength;

        if (this.streamingTimer) {
          clearTimeout(this.streamingTimer);
        }
        this.streamingTimer = setTimeout(() => {
          this.isStreaming = false;
        }, 100);
      }
    } else {
      this.parser.reset();
      this.lastLength = 0;
      this.safeHtmlCache.clear();
      if (content) {
        this.parser.appendChunk(content);
        this.lastLength = content.length;
      }
    }

    this.fragments = [...this.parser.getFragments()];
    this.isComplete = this.fragments.every(f => f.isComplete);

    this.fragmentUpdate.emit(this.fragments);

    if (this.isComplete && !this.previousIsComplete) {
      this.complete.emit();
    }
    this.previousIsComplete = this.isComplete;
  }

  trackByKey(_index: number, fragment: Fragment): string {
    return fragment.key;
  }

  // Fragment data extractors
  getLevel(fragment: Fragment): number {
    const data = fragment.data as { level?: number };
    return data?.level || 1;
  }

  getContent(fragment: Fragment): string {
    const data = fragment.data as { content?: string };
    return data?.content || '';
  }

  getCode(fragment: Fragment): string {
    const data = fragment.data as { code?: string };
    return data?.code || '';
  }

  getLang(fragment: Fragment): string {
    const data = fragment.data as { lang?: string };
    return data?.lang || '';
  }

  isOrdered(fragment: Fragment): boolean {
    const data = fragment.data as { ordered?: boolean };
    return data?.ordered || false;
  }

  getItems(fragment: Fragment): { content: string; checked?: boolean; level: number }[] {
    const data = fragment.data as { items?: { content: string; checked?: boolean; level: number }[] };
    return data?.items || [];
  }

  getImageSrc(fragment: Fragment): string {
    const data = fragment.data as { src?: string };
    return data?.src || '';
  }

  getImageAlt(fragment: Fragment): string {
    const data = fragment.data as { alt?: string };
    return data?.alt || '';
  }

  getImageTitle(fragment: Fragment): string {
    const data = fragment.data as { title?: string };
    return data?.title || '';
  }

  getImageHref(fragment: Fragment): string {
    const data = fragment.data as { href?: string };
    return data?.href || '';
  }

  getPartialType(fragment: Fragment): string {
    const data = fragment.data as { partialType?: string };
    return data?.partialType || '';
  }

  getAccumulatedContent(fragment: Fragment): string {
    const data = fragment.data as { accumulatedContent?: string };
    return data?.accumulatedContent || '';
  }

  getSafeHtml(fragment: Fragment): SafeHtml {
    const key = fragment.key;
    if (this.safeHtmlCache.has(key)) {
      return this.safeHtmlCache.get(key)!;
    }

    const content = this.getContent(fragment);
    const processed = content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

    const safeHtml = this.sanitizer.bypassSecurityTrustHtml(processed);
    this.safeHtmlCache.set(key, safeHtml);
    return safeHtml;
  }
}

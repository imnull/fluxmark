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
  ChangeDetectorRef,
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StreamingParser, type Fragment, type ParserOptions } from '@streaming-markdown/core';

@Component({
  selector: 'streaming-markdown',
  template: `
    <div class="streaming-markdown" [class.md-streaming]="isStreaming" [class.md-complete]="!isStreaming">
      <ng-container *ngFor="let fragment of fragments; trackBy: trackByKey; let i = index">

        <!-- Heading -->
        <ng-container *ngIf="fragment.type === 'heading'">
          <h1 *ngIf="getLevel(i) === 1" class="md-heading md-h1">{{ getContent(i) }}</h1>
          <h2 *ngIf="getLevel(i) === 2" class="md-heading md-h2">{{ getContent(i) }}</h2>
          <h3 *ngIf="getLevel(i) === 3" class="md-heading md-h3">{{ getContent(i) }}</h3>
          <h4 *ngIf="getLevel(i) === 4" class="md-heading md-h4">{{ getContent(i) }}</h4>
          <h5 *ngIf="getLevel(i) === 5" class="md-heading md-h5">{{ getContent(i) }}</h5>
          <h6 *ngIf="getLevel(i) === 6" class="md-heading md-h6">{{ getContent(i) }}</h6>
        </ng-container>

        <!-- Paragraph -->
        <p *ngIf="fragment.type === 'paragraph'" class="md-paragraph" [innerHTML]="getSafeHtml(i)"></p>

        <!-- CodeBlock -->
        <pre *ngIf="fragment.type === 'codeblock'" class="md-codeblock"><code [class]="getCodeClass(i)">{{ getCode(i) }}</code></pre>

        <!-- List -->
        <ng-container *ngIf="fragment.type === 'list'">
          <ul *ngIf="!isOrdered(i)" class="md-list md-unordered-list">
            <li *ngFor="let item of getItems(i)" class="md-list-item" [class.md-task-item]="item.checked !== undefined">
              <input *ngIf="item.checked !== undefined" type="checkbox" [checked]="item.checked" readonly class="md-task-checkbox" />
              {{ item.content }}
            </li>
          </ul>
          <ol *ngIf="isOrdered(i)" class="md-list md-ordered-list">
            <li *ngFor="let item of getItems(i)" class="md-list-item" [class.md-task-item]="item.checked !== undefined">
              <input *ngIf="item.checked !== undefined" type="checkbox" [checked]="item.checked" readonly class="md-task-checkbox" />
              {{ item.content }}
            </li>
          </ol>
        </ng-container>

        <!-- Blockquote -->
        <blockquote *ngIf="fragment.type === 'blockquote'" class="md-blockquote">
          <p>{{ getContent(i) }}</p>
        </blockquote>

        <!-- Image -->
        <figure *ngIf="fragment.type === 'image'" class="md-image-wrapper">
          <a *ngIf="getImageHref(i)" [href]="getImageHref(i)" target="_blank" rel="noopener noreferrer" class="md-image-link">
            <img [src]="getImageSrc(i)" [alt]="getImageAlt(i)" loading="lazy" class="md-image" />
          </a>
          <img *ngIf="!getImageHref(i)" [src]="getImageSrc(i)" [alt]="getImageAlt(i)" loading="lazy" class="md-image" />
          <figcaption *ngIf="getImageAlt(i)" class="md-image-caption">{{ getImageAlt(i) }}</figcaption>
        </figure>

        <!-- ThematicBreak -->
        <hr *ngIf="fragment.type === 'thematicBreak'" class="md-hr" />

        <!-- Incomplete (streaming) -->
        <div *ngIf="fragment.type === 'incomplete'" class="md-incomplete md-pending">
          <p *ngIf="getPartialType(i) === 'paragraph'" class="md-paragraph md-incomplete-content">
            {{ getAccumulatedContent(i) }}<span class="md-cursor">|</span>
          </p>
          <pre *ngIf="getPartialType(i) === 'codeblock'" class="md-codeblock md-incomplete-content"><code>{{ getAccumulatedContent(i) }}</code></pre>
          <div *ngIf="getPartialType(i) !== 'paragraph' && getPartialType(i) !== 'codeblock'" class="md-raw md-incomplete-content">
            {{ getAccumulatedContent(i) }}<span class="md-cursor">|</span>
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

  constructor(private sanitizer: DomSanitizer, private cdr: ChangeDetectorRef) {}

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
          this.cdr.markForCheck();
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

  // Data accessors using index
  private getData(index: number): any {
    return this.fragments[index]?.data || {};
  }

  getLevel(index: number): number {
    return this.getData(index).level || 1;
  }

  getContent(index: number): string {
    return this.getData(index).content || '';
  }

  getCode(index: number): string {
    return this.getData(index).code || '';
  }

  getCodeClass(index: number): string {
    const lang = this.getData(index).lang;
    return lang ? `language-${lang}` : '';
  }

  isOrdered(index: number): boolean {
    return this.getData(index).ordered || false;
  }

  getItems(index: number): any[] {
    return this.getData(index).items || [];
  }

  getImageSrc(index: number): string {
    return this.getData(index).src || '';
  }

  getImageAlt(index: number): string {
    return this.getData(index).alt || '';
  }

  getImageHref(index: number): string {
    return this.getData(index).href || '';
  }

  getPartialType(index: number): string {
    return this.getData(index).partialType || '';
  }

  getAccumulatedContent(index: number): string {
    return this.getData(index).accumulatedContent || '';
  }

  getSafeHtml(index: number): SafeHtml {
    const fragment = this.fragments[index];
    if (!fragment) return '';

    const key = fragment.key;
    if (this.safeHtmlCache.has(key)) {
      return this.safeHtmlCache.get(key)!;
    }

    const content = this.getContent(index);
    const processed = content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

    const safeHtml = this.sanitizer.bypassSecurityTrustHtml(processed);
    this.safeHtmlCache.set(key, safeHtml);
    return safeHtml;
  }
}

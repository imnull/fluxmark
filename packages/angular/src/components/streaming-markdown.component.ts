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
import { NgFor, NgIf, NgClass, NgStyle } from '@angular/common';
import { StreamingParser, type Fragment, type ParserOptions } from '@streaming-markdown/core';

@Component({
  selector: 'streaming-markdown',
  template: `
    <div [ngClass]="containerClasses">
      <ng-container *ngFor="let fragment of fragments; trackBy: trackByKey">
        <div *ngIf="fragment.type === 'heading'" [ngClass]="['md-heading', 'md-h' + getLevel(fragment)]">
          {{ getContent(fragment) }}
        </div>

        <p *ngIf="fragment.type === 'paragraph'" class="md-paragraph" [innerHTML]="getProcessedContent(fragment)"></p>

        <pre *ngIf="fragment.type === 'codeblock'" class="md-codeblock">
          <code [class]="getCodeClass(fragment)">{{ getCode(fragment) }}</code>
        </pre>

        <blockquote *ngIf="fragment.type === 'blockquote'" class="md-blockquote">
          <p>{{ getContent(fragment) }}</p>
        </blockquote>

        <figure *ngIf="fragment.type === 'image'" class="md-image-wrapper">
          <img
            [src]="getImageSrc(fragment)"
            [alt]="getImageAlt(fragment)"
            loading="lazy"
            class="md-image"
          />
          <figcaption *ngIf="getImageAlt(fragment)" class="md-image-caption">{{ getImageAlt(fragment) }}</figcaption>
        </figure>

        <hr *ngIf="fragment.type === 'thematicBreak'" class="md-hr" />

        <div *ngIf="isUnknownType(fragment)" class="md-unknown">{{ fragment.rawContent }}</div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgFor, NgIf, NgClass, NgStyle],
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

  get containerClasses(): string[] {
    return [
      'streaming-markdown',
      this.isStreaming ? 'md-streaming' : 'md-complete',
      this.class,
    ].filter(Boolean);
  }

  isUnknownType(fragment: Fragment): boolean {
    return !['heading', 'paragraph', 'codeblock', 'blockquote', 'image', 'thematicBreak', 'list', 'incomplete'].includes(fragment.type);
  }

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

  getCodeClass(fragment: Fragment): string {
    const data = fragment.data as { lang?: string };
    return data?.lang ? `language-${data.lang}` : '';
  }

  getImageSrc(fragment: Fragment): string {
    const data = fragment.data as { src?: string };
    return data?.src || '';
  }

  getImageAlt(fragment: Fragment): string {
    const data = fragment.data as { alt?: string };
    return data?.alt || '';
  }

  getProcessedContent(fragment: Fragment): string {
    const content = this.getContent(fragment);
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }
}

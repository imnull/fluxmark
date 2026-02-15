/**
 * StreamingParser Service
 *
 * Angular Service 封装流式解析器
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StreamingParser, type Fragment, type ParserOptions } from '@streaming-markdown/core';

export interface StreamingParserState {
  fragments: Fragment[];
  isComplete: boolean;
  isStreaming: boolean;
}

@Injectable()
export class StreamingParserService implements OnDestroy {
  private parser: StreamingParser | null = null;
  private lastLength = 0;
  private streamingTimer: ReturnType<typeof setTimeout> | null = null;

  private stateSubject = new BehaviorSubject<StreamingParserState>({
    fragments: [],
    isComplete: false,
    isStreaming: false,
  });

  public state$: Observable<StreamingParserState> = this.stateSubject.asObservable();

  constructor() {}

  /**
   * 初始化解析器
   */
  initialize(options?: ParserOptions): void {
    this.parser = new StreamingParser(options);
    this.lastLength = 0;
    this.updateState({
      fragments: [],
      isComplete: false,
      isStreaming: false,
    });
  }

  /**
   * 追加内容
   */
  appendContent(content: string): void {
    if (!this.parser) {
      this.initialize();
    }

    const currentLength = content.length;
    const prevLength = this.lastLength;

    if (
      currentLength >= prevLength &&
      content.startsWith(content.slice(0, prevLength))
    ) {
      // 追加模式
      const newChunk = content.slice(prevLength);

      if (newChunk) {
        this.parser!.appendChunk(newChunk);
        this.lastLength = currentLength;

        this.updateState({
          isStreaming: true,
        });

        // 防抖
        if (this.streamingTimer) {
          clearTimeout(this.streamingTimer);
        }
        this.streamingTimer = setTimeout(() => {
          this.updateState({ isStreaming: false });
        }, 100);
      }
    } else {
      // 重置模式
      this.parser!.reset();
      this.lastLength = 0;

      if (content) {
        this.parser!.appendChunk(content);
        this.lastLength = content.length;
      }
    }

    const fragments = [...this.parser!.getFragments()];
    const isComplete = fragments.every((f) => f.isComplete);

    this.updateState({
      fragments,
      isComplete,
    });
  }

  /**
   * 重置解析器
   */
  reset(): void {
    this.parser?.reset();
    this.lastLength = 0;
    this.updateState({
      fragments: [],
      isComplete: false,
      isStreaming: false,
    });
  }

  /**
   * 获取当前分片
   */
  getFragments(): Fragment[] {
    return this.stateSubject.value.fragments;
  }

  /**
   * 获取当前状态
   */
  getState(): StreamingParserState {
    return this.stateSubject.value;
  }

  /**
   * 最终化
   */
  finalize(): Fragment[] {
    const result = this.parser?.finalize() || [];
    const fragments = [...result] as Fragment[];
    this.updateState({
      fragments,
      isComplete: true,
      isStreaming: false,
    });
    return fragments;
  }

  private updateState(partial: Partial<StreamingParserState>): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      ...partial,
    });
  }

  ngOnDestroy(): void {
    if (this.streamingTimer) {
      clearTimeout(this.streamingTimer);
    }
    this.stateSubject.complete();
  }
}

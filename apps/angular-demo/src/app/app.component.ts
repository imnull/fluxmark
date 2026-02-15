import { Component, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { StreamingMarkdownComponent } from '@streaming-markdown/angular';
import '@streaming-markdown/angular/styles';
import { streamSimulator, demoContents } from './stream-simulator';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface DemoOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StreamingMarkdownComponent, FormsModule, NgFor, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <!-- 头部 -->
      <header class="header">
        <h1 class="title">🚀 Streaming Markdown Renderer (Angular)</h1>
        <p class="subtitle">AI 对话流式渲染演示</p>
      </header>

      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="control-group">
          <label class="label">演示内容：</label>
          <select
            [(ngModel)]="selectedDemo"
            [disabled]="isStreaming"
            class="select"
          >
            <option *ngFor="let option of demoOptions" [value]="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="control-group">
          <label class="label">速度：</label>
          <input
            type="range"
            min="10"
            max="200"
            [(ngModel)]="speed"
            [disabled]="isStreaming"
            class="slider"
          />
          <span class="speed-label">{{ speed }}ms</span>
        </div>

        <div class="control-group">
          <label class="label">源码对照：</label>
          <button
            (click)="showSource = !showSource"
            class="toggle-button"
            [class.active]="showSource"
          >
            {{ showSource ? '✓ 开启' : '关闭' }}
          </button>
        </div>

        <div class="button-group">
          <button
            (click)="runDemo()"
            [disabled]="isStreaming"
            class="button primary-button"
            [class.disabled]="isStreaming"
          >
            {{ isStreaming ? '渲染中...' : '运行演示' }}
          </button>

          <button
            *ngIf="isStreaming"
            (click)="stopStream()"
            class="button danger-button"
          >
            停止
          </button>

          <button
            (click)="clearChat()"
            [disabled]="isStreaming"
            class="button secondary-button"
            [class.disabled]="isStreaming"
          >
            清空
          </button>
        </div>
      </div>

      <!-- 聊天区域 -->
      <div class="chat-container" #chatContainer>
        <div *ngIf="messages.length === 0" class="empty-state">
          <div class="empty-icon">💬</div>
          <p>选择一个演示或输入消息开始</p>
        </div>

        <div *ngFor="let message of messages; trackBy: trackById"
          class="message"
          [class.user-message]="message.role === 'user'"
          [class.ai-message]="message.role === 'assistant'">
          <div class="message-header">
            <span class="message-role">
              {{ message.role === 'user' ? '👤 用户' : '🤖 AI' }}
            </span>
            <span *ngIf="message.isStreaming" class="streaming-indicator">
              ● 输入中
            </span>
          </div>

          <!-- 用户消息 -->
          <div *ngIf="message.role === 'user'" class="user-content">
            {{ message.content }}
          </div>

          <!-- AI 消息 -->
          <ng-container *ngIf="message.role === 'assistant'">
            <!-- 源码对照模式 -->
            <div *ngIf="showSource" class="source-view">
              <div class="source-panel">
                <div class="source-label">📄 Markdown 源码</div>
                <pre class="source-code">{{ message.content || '(空)' }}</pre>
              </div>
              <div class="divider"></div>
              <div class="render-panel">
                <div class="source-label">🎨 渲染结果</div>
                <streaming-markdown
                  [content]="message.content"
                  class="chat-message"
                />
              </div>
            </div>

            <!-- 正常渲染模式 -->
            <streaming-markdown
              *ngIf="!showSource"
              [content]="message.content"
              class="chat-message"
            />
          </ng-container>
        </div>
      </div>

      <!-- 输入框 -->
      <form class="input-area" (ngSubmit)="handleSendMessage()">
        <input
          [(ngModel)]="inputMessage"
          name="message"
          type="text"
          placeholder="输入消息..."
          [disabled]="isStreaming"
          class="input"
        />
        <button
          type="submit"
          [disabled]="isStreaming"
          class="send-button"
          [class.disabled]="isStreaming"
        >
          发送
        </button>
      </form>
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #fff;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
    }

    .header {
      padding: 20px 24px;
      background: linear-gradient(135deg, #dd0031 0%, #c3002f 100%);
      color: white;
    }

    .title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }

    .control-panel {
      padding: 16px 24px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    .control-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .label {
      font-size: 14px;
      font-weight: 500;
      color: #495057;
    }

    .select {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #ced4da;
      font-size: 14px;
      background: white;
      cursor: pointer;
    }

    .select:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .slider {
      width: 120px;
    }

    .slider:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .speed-label {
      font-size: 13px;
      color: #6c757d;
      min-width: 50px;
    }

    .toggle-button {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #ced4da;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      background: #e9ecef;
      color: #495057;
    }

    .toggle-button.active {
      background: #dd0031;
      color: white;
      border-color: #dd0031;
    }

    .button-group {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .button {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .button.disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .primary-button {
      background: #dd0031;
      color: white;
    }

    .primary-button:hover:not(.disabled) {
      background: #c3002f;
    }

    .secondary-button {
      background: #e9ecef;
      color: #495057;
    }

    .secondary-button:hover:not(.disabled) {
      background: #dee2e6;
    }

    .danger-button {
      background: #dc3545;
      color: white;
    }

    .danger-button:hover {
      background: #c82333;
    }

    .chat-container {
      flex: 1;
      overflow: auto;
      padding: 24px;
      background: #f5f5f5;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #6c757d;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .message {
      margin-bottom: 20px;
      padding: 16px;
      border-radius: 12px;
      max-width: 85%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .user-message {
      background: #dd0031;
      color: white;
      margin-left: auto;
      border-bottom-right-radius: 4px;
    }

    .ai-message {
      background: white;
      margin-right: auto;
      border-bottom-left-radius: 4px;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .message-role {
      font-weight: 600;
    }

    .streaming-indicator {
      color: #28a745;
      font-size: 12px;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .user-content {
      font-size: 15px;
      line-height: 1.5;
    }

    .source-view {
      display: flex;
      gap: 16px;
      flex-direction: row;
    }

    .source-panel, .render-panel {
      flex: 1;
      min-width: 0;
    }

    .divider {
      width: 1px;
      background: #e9ecef;
    }

    .source-label {
      font-size: 12px;
      font-weight: 600;
      color: #6c757d;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .source-code {
      margin: 0;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 6px;
      font-size: 13px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      line-height: 1.5;
      overflow: auto;
      max-height: 400px;
      border: 1px solid #e9ecef;
      color: #333;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .input-area {
      display: flex;
      gap: 12px;
      padding: 16px 24px;
      background: white;
      border-top: 1px solid #e9ecef;
    }

    .input {
      flex: 1;
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid #ced4da;
      font-size: 15px;
      outline: none;
    }

    .input:focus {
      border-color: #dd0031;
      box-shadow: 0 0 0 2px rgba(221, 0, 49, 0.2);
    }

    .input:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .send-button {
      padding: 10px 24px;
      border-radius: 8px;
      border: none;
      background: #dd0031;
      color: white;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .send-button:hover:not(.disabled) {
      background: #c3002f;
    }

    .send-button.disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    @media (max-width: 768px) {
      .control-panel {
        flex-direction: column;
        align-items: flex-start;
      }

      .button-group {
        margin-left: 0;
        width: 100%;
        justify-content: flex-end;
      }

      .source-view {
        flex-direction: column;
      }

      .divider {
        width: 100%;
        height: 1px;
      }

      .message {
        max-width: 95%;
      }
    }
  `],
})
export class AppComponent implements OnDestroy {
  messages: Message[] = [];
  isStreaming = false;
  speed = 50;
  selectedDemo = 'mixed';
  showSource = false;
  inputMessage = '';

  demoOptions: DemoOption[] = [
    { value: 'mixed', label: '混合内容' },
    { value: 'code', label: '代码展示' },
    { value: 'images', label: '图片测试' },
    { value: 'long', label: '长文本' },
  ];

  private abortController: (() => void) | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  trackById(_index: number, item: Message): string {
    return item.id;
  }

  runDemo(): void {
    if (this.isStreaming) return;

    const demoContent = demoContents[this.selectedDemo];
    if (!demoContent) return;

    this.addUserMessage(`演示：${demoContent.title}`);

    setTimeout(() => {
      this.startAIStream(demoContent.content);
    }, 300);
  }

  stopStream(): void {
    this.abortController?.();
    this.abortController = null;
    this.isStreaming = false;
    this.messages.forEach((msg) => {
      if (msg.isStreaming) {
        msg.isStreaming = false;
      }
    });
    this.cdr.markForCheck();
  }

  clearChat(): void {
    this.stopStream();
    this.messages = [];
    this.cdr.markForCheck();
  }

  handleSendMessage(): void {
    if (!this.inputMessage.trim() || this.isStreaming) return;

    const content = this.inputMessage;
    this.inputMessage = '';

    this.addUserMessage(content);

    setTimeout(() => {
      const reply = `收到你的消息："${content}"\n\n这是一个示例回复，展示了流式渲染的效果。`;
      this.startAIStream(reply);
    }, 500);
  }

  private addUserMessage(content: string): void {
    this.messages.push({
      id: Date.now().toString(),
      role: 'user',
      content,
    });
    this.cdr.markForCheck();
    this.scrollToBottom();
  }

  private startAIStream(content: string): void {
    const messageId = (Date.now() + 1).toString();

    this.messages.push({
      id: messageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    });

    this.isStreaming = true;
    this.cdr.markForCheck();

    this.abortController = streamSimulator({
      content,
      chunkDelay: this.speed,
      simulateJitter: true,
      onChunk: (chunk) => {
        const msg = this.messages.find((m) => m.id === messageId);
        if (msg) {
          msg.content += chunk;
          this.cdr.markForCheck();
        }
      },
      onComplete: () => {
        const msg = this.messages.find((m) => m.id === messageId);
        if (msg) {
          msg.isStreaming = false;
        }
        this.isStreaming = false;
        this.abortController = null;
        this.cdr.markForCheck();
      },
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = document.querySelector('.chat-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  ngOnDestroy(): void {
    this.stopStream();
  }
}

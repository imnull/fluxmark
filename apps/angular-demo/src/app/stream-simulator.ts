/**
 * 流式数据模拟器
 *
 * 用于模拟 AI 对话的 SSE 流式输出
 */

export interface StreamOptions {
  /** 完整的 Markdown 内容 */
  content: string;
  /** 每个 chunk 之间的延迟（毫秒） */
  chunkDelay?: number;
  /** 是否模拟网络抖动（随机分割） */
  simulateJitter?: boolean;
  /** 每个 chunk 的最大字符数 */
  maxChunkSize?: number;
  /** 收到 chunk 时的回调 */
  onChunk: (chunk: string) => void;
  /** 完成时的回调 */
  onComplete: () => void;
}

/**
 * 启动流式模拟
 * @returns 取消函数
 */
export function streamSimulator(options: StreamOptions): () => void {
  const {
    content,
    chunkDelay = 50,
    simulateJitter = true,
    maxChunkSize = 10,
    onChunk,
    onComplete,
  } = options;

  const chunks = simulateJitter
    ? splitWithJitter(content, maxChunkSize)
    : splitBySize(content, maxChunkSize);

  let index = 0;
  let cancelled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function sendNextChunk(): void {
    if (cancelled || index >= chunks.length) {
      if (!cancelled) {
        onComplete();
      }
      return;
    }

    const chunk = chunks[index];
    onChunk(chunk);
    index++;

    const delay = simulateJitter
      ? chunkDelay * (0.5 + Math.random())
      : chunkDelay;

    timerId = setTimeout(sendNextChunk, delay);
  }

  sendNextChunk();

  return () => {
    cancelled = true;
    if (timerId) {
      clearTimeout(timerId);
    }
  };
}

function splitWithJitter(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    const size = Math.max(1, Math.floor(Math.random() * maxSize) + 1);
    chunks.push(text.slice(pos, pos + size));
    pos += size;
  }

  return chunks;
}

function splitBySize(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

// ===== 演示内容 =====

export const demoContents: Record<string, { title: string; content: string }> = {
  mixed: {
    title: '混合内容',
    content: `# 欢迎使用 Streaming Markdown Renderer

这是一个**流式渲染**的演示，展示了如何优雅地处理 AI 对话中的 Markdown 内容。

## 核心特性

- 🚀 **零闪烁**：已渲染内容不因后续更新而重新加载
- ⚡ **高性能**：基于内容哈希的增量渲染
- 🎨 **代码高亮**：支持异步语法高亮

## 代码示例

\`\`\`typescript
interface Fragment {
  key: string;           // 基于内容的稳定哈希
  type: FragmentType;    // 分片类型
  isComplete: boolean;   // 是否已完成
}

function renderStream(content: string) {
  return <StreamingMarkdown content={content} />;
}
\`\`\`

## 图片展示

![示例图片](https://picsum.photos/400/200?random=1)

## 列表示例

1. 第一项
2. 第二项
   - 子项 A
   - 子项 B
3. 第三项

> 这是一个引用块，展示了流式渲染中的引用处理。

---

*感谢使用 Streaming Markdown Renderer！*`,
  },

  code: {
    title: '代码展示',
    content: `# 代码展示示例

## TypeScript

\`\`\`typescript
// Angular 组件示例
@Component({
  selector: 'app-example',
  template: '<div>{{ message }}</div>',
  standalone: true,
})
export class ExampleComponent {
  message = 'Hello Angular!';
}
\`\`\`

## Python

\`\`\`python
def fibonacci(n):
    """计算斐波那契数列"""
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
\`\`\`

## CSS

\`\`\`css
.streaming-markdown {
  font-family: -apple-system, sans-serif;
  line-height: 1.6;
}

.md-codeblock {
  background: #f6f8fa;
  border-radius: 6px;
  padding: 16px;
}
\`\`\``,
  },

  images: {
    title: '图片测试',
    content: `# 图片防闪烁测试

下面的图片在流式渲染过程中应该保持稳定，不会出现闪烁或重新加载。

## 单张图片

![风景图片](https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=200&fit=crop)

这是一张风景图片的说明文字。

## 多张连续图片

![城市夜景](https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&h=200&fit=crop)

![山脉风光](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=200&fit=crop)

![海滨日落](https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=200&fit=crop)

## 带链接的图片

[![点击查看大图](https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=300&h=150&fit=crop)](https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop)

> 💡 **观察要点**：
> 1. 每张图片只会加载一次
> 2. 图片在段落中间时，应该被正确提取为独立分片
> 3. 多张连续图片应该各自独立渲染`,
  },

  long: {
    title: '长文本',
    content: `# 长文本渲染测试

这是一篇较长的文章，用于测试流式渲染的性能和稳定性。

## 第一章：引言

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## 第二章：核心概念

### 2.1 分片渲染

流式 Markdown 渲染器的核心思想是将内容分割成独立的片段（Fragment）。

\`\`\`typescript
interface Fragment {
  key: string;
  type: 'heading' | 'paragraph' | 'codeblock';
  content: string;
  isComplete: boolean;
}
\`\`\`

### 2.2 增量更新

当新的内容到达时，只有未完成的部分会更新。

### 2.3 性能优化

- 使用 OnPush 变更检测策略
- 基于内容哈希的稳定 key
- 图片预加载和缓存

## 第三章：应用场景

1. **AI 对话系统**：流式输出大模型的回复
2. **实时协作编辑**：多人同时编辑文档
3. **日志查看器**：实时显示系统日志

## 结语

感谢阅读这篇长文本测试文章。`,
  },
};

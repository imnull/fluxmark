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

  // 生成 chunks
  const chunks = simulateJitter
    ? splitWithJitter(content, maxChunkSize)
    : splitBySize(content, maxChunkSize);

  let index = 0;
  let cancelled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function sendNextChunk() {
    if (cancelled || index >= chunks.length) {
      if (!cancelled) {
        onComplete();
      }
      return;
    }

    const chunk = chunks[index];
    onChunk(chunk);
    index++;

    // 计算延迟（如果启用了抖动，随机化延迟）
    const delay = simulateJitter
      ? chunkDelay * (0.5 + Math.random())
      : chunkDelay;

    timerId = setTimeout(sendNextChunk, delay);
  }

  // 开始发送
  sendNextChunk();

  // 返回取消函数
  return () => {
    cancelled = true;
    if (timerId) {
      clearTimeout(timerId);
    }
  };
}

/**
 * 随机分割文本（模拟网络抖动）
 */
function splitWithJitter(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    // 随机 chunk 大小，但不超过 maxSize
    const size = Math.max(1, Math.floor(Math.random() * maxSize) + 1);
    chunks.push(text.slice(pos, pos + size));
    pos += size;
  }

  return chunks;
}

/**
 * 固定大小分割文本
 */
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

## JavaScript

\`\`\`javascript
// 异步函数示例
async function fetchUserData(userId) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
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

# 打印前10个斐波那契数
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
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
\`\`\`

## SQL

\`\`\`sql
SELECT
  u.id,
  u.name,
  COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= '2024-01-01'
GROUP BY u.id
ORDER BY order_count DESC;
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

## 图文混排示例

下面这段文字中**嵌入了图片**，展示了如何在段落中间插入图片。

这是一段普通的文字内容。![小图标1](https://via.placeholder.com/80x80/667eea/ffffff?text=IMG1) 图片出现在句子中间。继续输入更多文字，验证图片是否会影响后续内容的渲染。

再来一段，包含![小图标2](https://via.placeholder.com/80x80/764ba2/ffffff?text=IMG2)多张图片![小图标3](https://via.placeholder.com/80x80/28a745/ffffff?text=IMG3)在文字中。

## 图片列表

下面是一组图片展示：

![图片A](https://via.placeholder.com/150x150/667eea/ffffff?text=A) ![图片B](https://via.placeholder.com/150x150/764ba2/ffffff?text=B) ![图片C](https://via.placeholder.com/150x150/dc3545/ffffff?text=C)

## 带链接的图片

[![点击查看大图](https://via.placeholder.com/300x150/667eea/ffffff?text=Click+Me)](https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop)

点击图片可以查看大图（如果支持的话）。

## 图文交替布局示例

**第一张图片**：

![交替1](https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=350&h=200&fit=crop)

Lorem ipsum dolor sit amet, consectetur adipiscing elit. 这段文字紧跟在图片后面。

**第二张图片**：

![交替2](https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=350&h=200&fit=crop)

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

**第三张图片**：

![交替3](https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=350&h=200&fit=crop)

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

> 💡 **观察要点**：
> 1. 每张图片只会加载一次，后续文本更新不会导致重新加载
> 2. 图片在段落中间时，应该被正确提取为独立分片
> 3. 多张连续图片应该各自独立渲染，有独立的 key
> 4. 图片加载完成后，即使后续内容变化，图片也保持稳定`,
  },

  long: {
    title: '长文本',
    content: `# 长文本渲染测试

这是一篇较长的文章，用于测试流式渲染的性能和稳定性。

## 第一章：引言

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

## 第二章：核心概念

### 2.1 分片渲染

流式 Markdown 渲染器的核心思想是将内容分割成独立的片段（Fragment）。每个片段都有自己的唯一标识符（key），基于内容计算得出。

\`\`\`typescript
interface Fragment {
  key: string;
  type: 'heading' | 'paragraph' | 'codeblock';
  content: string;
  isComplete: boolean;
}
\`\`\`

### 2.2 增量更新

当新的内容到达时，只有未完成的部分会更新，已完成的片段保持稳定。这避免了整个文档的重新渲染。

### 2.3 性能优化

- 使用 memo 防止不必要的重渲染
- 基于内容哈希的稳定 key
- 图片预加载和缓存

## 第三章：应用场景

1. **AI 对话系统**：流式输出大模型的回复
2. **实时协作编辑**：多人同时编辑文档
3. **日志查看器**：实时显示系统日志
4. **代码审查**：逐步展示代码变更

## 第四章：总结

Streaming Markdown Renderer 提供了一种优雅的方式来处理流式内容的渲染。通过合理的分片策略和优化，实现了高性能、零闪烁的渲染效果。

## 代码示例

\`\`\`javascript
import { StreamingMarkdown } from '@streaming-markdown/vue';

// Vue 3 Composition API
const content = ref('');
\`\`\`

## 结语

感谢阅读这篇长文本测试文章。通过流式渲染技术，我们可以提供更流畅、更高效的用户体验。`,
  },
};

export default streamSimulator;

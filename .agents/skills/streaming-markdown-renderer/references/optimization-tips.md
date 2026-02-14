# 性能优化建议

## 核心优化策略

### 1. Key 生成优化

Key 的稳定性直接决定 React 的复用效率：

```typescript
// ✅ 好：基于内容生成稳定 key
const key = `frag-${murmurHash3(content)}`;

// ❌ 坏：包含随机因素，永远无法复用
const key = `frag-${Math.random()}`;

// ❌ 坏：包含时间戳
const key = `frag-${hash}-${Date.now()}`;
```

### 2. 未完成块的更新频率控制

```typescript
// 使用 requestAnimationFrame 批量更新
class StreamingParser {
  private pendingUpdate = false;
  
  appendChunk(chunk: string) {
    this.buffer += chunk;
    
    if (!this.pendingUpdate) {
      this.pendingUpdate = true;
      requestAnimationFrame(() => {
        this.parseIncremental();
        this.pendingUpdate = false;
      });
    }
  }
}
```

### 3. 图片预加载

```typescript
// 检测到图片时立即预加载
function preloadImage(src: string) {
  const img = new Image();
  img.src = src;
}

// 在 parser 中检测图片
if (fragment.type === 'image') {
  const data = fragment.data as ImageData;
  preloadImage(data.src);
}
```

## 内存优化

### 1. 长对话的内存管理

```typescript
class StreamingParser {
  private maxFragments = 1000;
  
  private cleanupOldFragments() {
    if (this.fragments.length > this.maxFragments) {
      // 保留最近 N 个，或已完成的部分
      const completedCount = this.fragments.filter(f => f.isComplete).length;
      if (completedCount > this.maxFragments * 0.8) {
        // 清理最早完成的 20%
        const toRemove = this.maxFragments * 0.2;
        this.fragments = this.fragments.slice(toRemove);
      }
    }
  }
}
```

### 2. 文本去重

```typescript
// 使用 String interning 减少内存
const stringPool = new Map<string, string>();

function internString(str: string): string {
  const existing = stringPool.get(str);
  if (existing) return existing;
  
  if (stringPool.size < 10000) {
    stringPool.set(str, str);
  }
  return str;
}
```

## 渲染优化

### 1. CSS Containment

```css
.streaming-markdown {
  contain: layout style paint;
}

.fragment {
  contain: layout;
}
```

### 2. 图片加载优化

```tsx
const ImageRenderer = memo(({ fragment }) => {
  const { src, alt } = fragment.data as ImageData;
  const [loaded, setLoaded] = useState(false);
  
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.2s',
        willChange: loaded ? undefined : 'opacity',
      }}
      onLoad={() => setLoaded(true)}
    />
  );
});
```

### 3. 代码高亮优化

```typescript
// 只对可见代码块进行高亮
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      highlightCodeBlock(entry.target);
    }
  });
});
```

## 网络优化

### 1. 增量传输优化

```typescript
// 使用 ReadableStream
const response = await fetch('/api/stream');
const reader = response.body?.getReader();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;
  
  const text = new TextDecoder().decode(value);
  parser.appendChunk(text);
}
```

### 2. 压缩传输

```typescript
// 启用 gzip/br 压缩
const response = await fetch('/api/stream', {
  headers: {
    'Accept-Encoding': 'gzip, br',
  },
});
```

## 调试与监控

### 1. 性能指标收集

```typescript
interface PerformanceMetrics {
  parseTime: number;
  renderTime: number;
  fragmentCount: number;
  memoryUsage: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  
  record(metrics: PerformanceMetrics) {
    this.metrics.push(metrics);
    
    if (this.metrics.length > 100) {
      this.analyzeAndReport();
    }
  }
  
  private analyzeAndReport() {
    const avgParseTime = this.metrics.reduce((a, b) => a + b.parseTime, 0) / this.metrics.length;
    console.log(`Average parse time: ${avgParseTime.toFixed(2)}ms`);
  }
}
```

### 2. React DevTools Profiler

```tsx
<Profiler id="StreamingMarkdown" onRender={onRenderCallback}>
  <StreamingMarkdown content={content} />
</Profiler>

function onRenderCallback(
  id: string,
  phase: "mount" | "update",
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  console.log(`${id} ${phase} took ${actualDuration}ms`);
}
```

## 常见问题排查

### 图片仍然闪烁

检查清单：
1. ✅ Image fragment 的 key 是否稳定？
2. ✅ 图片 URL 是否变化？
3. ✅ React.memo 是否正确配置？
4. ✅ 是否有父组件强制 re-render？

### 内存泄漏

检查点：
1. Parser 是否正确清理？
2. 事件监听器是否移除？
3. IntersectionObserver 是否 disconnect？

### 性能瓶颈

使用 Chrome DevTools：
1. Performance 面板分析渲染时间
2. Memory 面板检查内存增长
3. Network 面板检查传输效率

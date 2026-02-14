# 流式 Markdown 渲染组件 - 产品需求文档 (PRD)

**版本**: v1.0  
**日期**: 2026-02-14  
**状态**: ✅ 已确认

---

## 1. 背景与痛点

### 1.1 问题描述

在 AI 对话应用中，大模型通过 SSE (Server-Sent Events) 流式返回 Markdown 格式内容。当前常见实现存在以下问题：

| 问题 | 影响 | 场景 |
|------|------|------|
| 图片闪烁 | 用户体验差，视觉疲劳 | 回答中包含图片时 |
| 代码高亮重复执行 | CPU 浪费，滚动位置跳动 | 代码块持续输出时 |
| 整体重新渲染 | 性能下降，输入卡顿 | 长回答 (>1000 tokens) |
| 光标/动画重置 | 打字机效果中断 | 有 CSS 动画时 |

### 1.2 现有方案缺陷

- **整文本重新解析**：每次 chunk 到达后替换全部内容，React 无法复用 DOM
- **Virtual List**：不适合对话场景，上下文丢失，无法实现平滑滚动
- **简单 memo**：文本内容变化导致 React 判定需要重新渲染

---

## 2. 产品目标

### 2.1 核心目标

构建一个面向 AI 对话场景的流式 Markdown 渲染组件，实现：

1. **零闪烁**：已渲染内容（特别是图片）不因后续内容更新而重新加载
2. **增量渲染**：仅渲染新增/变化部分，已完成部分保持静止
3. **高性能**：支持长文本（10k+ tokens）流式渲染不卡顿
4. **易集成**：提供 React 组件，接口简单，即插即用

### 2.2 成功指标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 图片重加载次数 | 0 | DevTools Network 面板 |
| 已完成代码块重渲染次数 | 0 | React DevTools Profiler |
| 渲染帧率 | > 30fps | Chrome Performance 面板 |
| 内存增长 | 线性，无泄漏 | Chrome Memory 面板 |

---

## 3. 功能需求

### 3.1 核心功能

#### FR-001: 流式解析器 (Streaming Parser)
- **描述**: 支持增量输入的 Markdown 解析器
- **输入**: 分段的 Markdown 文本（通过 `appendChunk` 方法）
- **输出**: 结构化的分片数组（Fragment[]）
- **要求**:
  - 维护内部缓冲区，处理跨 chunk 的边界问题
  - 支持随时获取当前已解析的分片
  - 提供 `reset` 方法清空状态
  - 提供 `finalize` 方法标记流结束

#### FR-002: 块级分片 (Block-level Fragmentation)
- **描述**: 按 Markdown 块级元素分片
- **支持类型**:
  | 类型 | 示例 | 优先级 |
  |------|------|--------|
  | Heading | `# Title` | P0 |
  | Paragraph | `Text` | P0 |
  | CodeBlock | `\`\`\`code\`\`\`` | P0 |
  | List | `- item` | P0 |
  | Blockquote | `> quote` | P1 |
  | Image | `![alt](url)` | P0（单独分片） |
  | Table | `| a | b |` | P2 |
  | HTML | `<div>` | P2 |

#### FR-003: 内容哈希 Key (Content-based Hash Key)
- **描述**: 为每个分片生成基于内容的稳定 key
- **已完成分片**: `frag-${hash(content)}`
  - Hash 算法: MurmurHash3（快速、分布均匀）
  - 相同内容 → 相同 key → React 复用 DOM
- **未完成分片**: `temp-${index}-${length}-${timestamp}`
  - 临时 key，允许重新渲染
  - 完成后转换为稳定 key

#### FR-004: 未完成块细粒度分片 (Granular Incomplete Block)
- **描述**: 流式传输中的未完成块需要更细粒度处理
- **代码块**: 按行分片
  - 每完成一行，该行 key 固化
  - 只有最后一行使用临时 key
- **段落**: 按句子或长度阈值分片（可选）
- **目标**: 避免整代码块因新增一行而全部重渲染

#### FR-005: 图片单独分片 (Image Isolation)
- **描述**: 图片标记必须独立成段
- **场景**: `Text ![img](url) more text` → 3 个分片
- **目的**: 图片使用独立 key，不受周围文本变化影响
- **优化**: 检测到图片 URL 时预加载

### 3.2 React 组件

#### FR-006: StreamingMarkdown 组件
```tsx
interface StreamingMarkdownProps {
  content: string;                    // 当前累积的 Markdown 内容
  options?: ParserOptions;            // 解析器配置
  components?: Partial<ComponentMap>; // 自定义渲染组件
  className?: string;                 // 容器类名
  onComplete?: () => void;            // 全部分片完成回调
}
```

#### FR-007: useStreamingParser Hook
```tsx
function useStreamingParser(
  content: string,
  options?: ParserOptions
): {
  fragments: Fragment[];
  isComplete: boolean;
  isStreaming: boolean;
}
```

### 3.3 配置选项

```typescript
interface ParserOptions {
  // 未完成代码块的分片策略
  incompleteCodeStrategy: 'line' | 'char' | 'none';
  
  // Hash 算法选择
  hashAlgorithm: 'murmur3' | 'djb2';
  
  // 是否预加载图片
  preloadImages: boolean;
  
  // 未完成段落分片阈值（字符数）
  paragraphChunkThreshold: number;
}
```

---

## 4. 非功能需求

### 4.1 性能要求

| 场景 | 要求 |
|------|------|
| 解析速度 | > 10MB/s |
| 渲染帧率 | 流式输入时保持 30fps+ |
| 内存占用 | 长对话（100+ 消息）不崩溃 |
| 首屏时间 | < 100ms |

### 4.2 兼容性

- **浏览器**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **React**: 18.0+
- **TypeScript**: 5.0+

### 4.3 扩展性

- Core 层接口清晰，便于后续 Rust/WASM 重写
- 支持自定义组件映射
- 支持插件机制（未来）

---

## 5. 用户故事

### US-001: AI 对话用户
> 作为 AI 对话应用的用户，我希望在 AI 生成包含图片的回答时，图片不要一直闪烁，这样我可以舒适地阅读内容。

**验收标准**:
- 图片加载后保持稳定
- 后续文本更新不影响图片

### US-002: 开发者
> 作为前端开发者，我希望使用一个简单的 React 组件就能实现流式 Markdown 渲染，而不需要关心复杂的解析逻辑。

**验收标准**:
- `<StreamingMarkdown content={streamContent} />` 即可工作
- 提供 TypeScript 类型定义

### US-003: 性能优化工程师
> 作为性能工程师，我希望代码高亮只在代码块完成时执行一次，而不是每来一个 chunk 就执行一次。

**验收标准**:
- 已完成代码行不重新高亮
- React DevTools 显示已完成的代码组件不重新渲染

---

## 6. 里程碑规划

### Milestone 1: Core Parser (Week 1)
- [ ] StreamingParser 基础实现
- [ ] 块级分片（Heading, Paragraph, CodeBlock, List）
- [ ] MurmurHash3 key 生成
- [ ] 单元测试

### Milestone 2: React 集成 (Week 2)
- [ ] useStreamingParser Hook
- [ ] StreamingMarkdown 组件
- [ ] Fragment 渲染器（memo 优化）
- [ ] 基础样式

### Milestone 3: 高级特性 (Week 3)
- [ ] 图片单独分片
- [ ] 代码块按行细粒度分片
- [ ] 图片预加载
- [ ] 性能测试与优化

### Milestone 4: 完善与文档 (Week 4)
- [ ] TypeScript 类型完善
- [ ] API 文档
- [ ] 示例应用
- [ ] 边界情况处理

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Hash 冲突 | 不同内容相同 key，React 不更新 | 使用 32bit hash，冲突概率极低；可加盐值 |
| 复杂 Markdown 边界 | 解析错误 | 完善测试用例，参考 CommonMark 规范 |
| 超长代码块 | 内存占用高 | 限制分片数量，支持虚拟滚动（未来） |
| XSS 安全 | 渲染恶意代码 | 默认转义 HTML，自定义组件时开发者负责安全 |

---

## 8. 附录

### 8.1 参考实现

- [react-markdown](https://github.com/remarkjs/react-markdown) - 参考组件设计
- [micromark](https://github.com/micromark/micromark) - 参考解析逻辑
- [react-window](https://github.com/bvaughn/react-window) - 参考虚拟滚动（未来）

### 8.2 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-02-14 | 初始版本 |

---

**待确认事项**:
1. P2 优先级功能（Table、HTML）是否推迟到 v2？
2. 是否需要支持 Vue/Svelte 组件？
3. Rust/WASM 迁移的时间规划？
4. 是否支持自定义扩展语法（如 Mermaid、KaTeX）？

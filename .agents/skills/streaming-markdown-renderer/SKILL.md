---
name: streaming-markdown-renderer
description: 流式 Markdown 渲染组件开发技能。用于构建 AI 对话场景下的流式 Markdown 渲染器，解决流式内容更新时的图片闪烁、代码高亮重复执行等问题。核心特性包括：块级分片解析、内容哈希生成固化 key、增量渲染、图片单独分片处理。适用于需要流式渲染 Markdown 的 AI 聊天应用。
---

# Streaming Markdown Renderer

流式 Markdown 渲染组件开发技能，专门解决 AI 对话场景下的流式内容渲染问题。

## 核心问题

AI 对话中，流式返回的 Markdown 内容每次更新都会导致整个组件重新渲染，引发：
- 图片重复加载闪烁
- 代码高亮重复执行
- 性能浪费

## 解决方案架构

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Stream Text    │────▶│  Markdown Parser │────▶│  Fragment[]     │
│  (chunked)      │     │  (incremental)   │     │  (structured)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Render   │◄────│  Key Stabilizer  │◄────│  Hash Generator │
│  (memoized)     │     │  (stable keys)   │     │  (content-based)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## 快速开始

### 1. 创建核心 Parser

```typescript
import { StreamingParser } from './core/parser';

const parser = new StreamingParser();

// 流式输入
parser.appendChunk("# Hello\n\nThis is a ");
const fragments1 = parser.getFragments();

parser.appendChunk("paragraph with **bold** text.");
const fragments2 = parser.getFragments();
```

### 2. React 组件使用

```tsx
import { StreamingMarkdown } from './react/StreamingMarkdown';

function ChatMessage({ streamContent }) {
  return <StreamingMarkdown content={streamContent} />;
}
```

## 分片策略

### 块级分片

| 类型 | 开始标记 | 结束标记 | 说明 |
|------|----------|----------|------|
| Paragraph | 非特殊字符行 | 空行或新块开始 | 普通段落 |
| CodeBlock | ``` | ``` | 代码块 |
| Heading | #~###### | 行尾 | 标题 |
| List | - / * / 1. | 空行或缩进减少 | 列表 |
| Image | ![ | ) | 图片（单独分片）|
| Blockquote | > | 空行 | 引用 |

### 未完成块处理

末尾未完成块使用更细粒度分片：
- 代码块：按行分片，已完成的行 key 固化
- 段落：按句子或特定长度分片

## Hash 生成策略

```typescript
// 已完成块：基于完整内容生成 hash
const hash = murmurHash3(block.content);

// 未完成块：基于内容 + 序列号生成临时 key
const tempKey = `incomplete-${index}-${content.length}`;
```

## 实现步骤

1. **阅读架构设计**：查看 [references/architecture.md](references/architecture.md)
2. **实现 Core Parser**：按 [references/implementation-guide.md](references/implementation-guide.md) 步骤实现
3. **实现 React 组件**：参考 [references/react-integration.md](references/react-integration.md)
4. **测试验证**：使用提供的测试用例

## 关键文件

- `references/architecture.md` - 详细架构设计
- `references/api-reference.md` - API 参考
- `references/implementation-guide.md` - 分步实现指南
- `references/react-integration.md` - React 集成方案
- `references/optimization-tips.md` - 性能优化建议

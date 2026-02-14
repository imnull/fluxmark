# Streaming Markdown Renderer

流式 Markdown 渲染组件，专为 AI 对话场景设计。解决流式内容更新时的图片闪烁、代码高亮重复执行等问题。

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🚀 **零闪烁** | 已渲染内容（特别是图片）不因后续内容更新而重新加载 |
| ⚡ **高性能** | 基于内容哈希的增量渲染，React 完美复用 DOM |
| 📝 **代码高亮** | 支持异步语法高亮，不阻塞主线程 |
| 🖼️ **图片隔离** | 图片独立分片，独立 key 管理 |
| 📱 **细粒度更新** | 代码块按行分片，避免整体重渲染 |

## 🎯 使用场景

- **AI 对话应用**：流式输出大模型的 Markdown 回复
- **实时协作编辑**：多人同时编辑文档
- **日志查看器**：实时显示系统日志
- **代码审查**：逐步展示代码变更

## 📦 安装

```bash
# Core 包
npm install @streaming-markdown/core

# React 组件
npm install @streaming-markdown/react
```

## 🚀 快速开始

### Core 包

```typescript
import { StreamingParser } from '@streaming-markdown/core';

const parser = new StreamingParser();

// 流式输入（如从 SSE 接收）
parser.appendChunk("# Hello\n\n");
parser.appendChunk("World!");

const fragments = parser.getFragments();
console.log(fragments);
// [
//   { key: "frag-a1b2c3d4", type: "heading", content: "Hello", isComplete: true },
//   { key: "temp-1-6-123456789", type: "paragraph", content: "World!", isComplete: false }
// ]

// 结束流
parser.finalize();
```

### React 组件

```tsx
import { StreamingMarkdown } from '@streaming-markdown/react';
import '@streaming-markdown/react/styles';

function ChatMessage({ streamContent }) {
  return <StreamingMarkdown content={streamContent} />;
}
```

## 🏗️ 项目结构

```
packages/
├── core/                 # 核心解析器
│   ├── src/
│   │   ├── parser.ts     # StreamingParser 类
│   │   ├── types/        # TypeScript 类型
│   │   └── utils/        # Hash 工具
│   └── tests/
│       ├── parser.test.ts           # 26 个单元测试
│       └── mock-ai-stream.ts        # 流式模拟工具
│
└── react/                # React 组件
    ├── src/
    │   ├── components/   # 渲染器组件
    │   ├── hooks/        # useStreamingParser
    │   └── types/        # 类型定义
    └── tests/

apps/
└── demo/                 # 演示应用
    ├── src/
    │   ├── App.tsx       # 主应用
    │   └── streamSimulator.ts  # 流式模拟
    └── dist/             # 构建输出
```

## ✅ 项目进度

### Milestone 1: Core Parser ✅
- [x] 流式解析器（`StreamingParser`）
- [x] 块级分片（Heading, Paragraph, CodeBlock, List, Blockquote, Image）
- [x] MurmurHash3 内容哈希
- [x] 图片单独分片
- [x] 代码块行级分片
- [x] 26 个单元测试

### Milestone 2: React 集成 ✅
- [x] `useStreamingParser` Hook
- [x] `StreamingMarkdown` 组件
- [x] 各类型渲染器（带 memo 优化）
- [x] 图片防闪烁优化
- [x] 代码高亮支持
- [x] 默认 CSS 样式

### Milestone 3: 示例应用 ✅
- [x] 完整的演示应用
- [x] SSE 流式数据模拟
- [x] 多种 Markdown 内容演示
- [x] 控制面板（速度、演示选择）

## 🎮 运行演示

```bash
# 克隆仓库
git clone <repo-url>
cd streaming-markdown-renderer

# 安装依赖
cd apps/demo
npm install

# 启动开发服务器
npm run dev

# 打开 http://localhost:3000
```

## 📚 技术方案

详见 [TECH-SPEC.md](./TECH-SPEC.md)

## 📝 产品需求

详见 [PRD.md](./PRD.md)

## 🔧 API 参考

### StreamingParser

```typescript
class StreamingParser {
  constructor(options?: ParserOptions);
  
  // 追加文本块
  appendChunk(chunk: string): void;
  
  // 获取当前分片
  getFragments(): Fragment[];
  
  // 结束流，返回最终分片
  finalize(): Fragment[];
  
  // 重置状态
  reset(): void;
}
```

### StreamingMarkdown Props

```typescript
interface StreamingMarkdownProps {
  content: string;                    // Markdown 内容
  options?: ParserOptions;            // 解析选项
  components?: Partial<ComponentMap>; // 自定义组件
  className?: string;                 // 容器类名
  onComplete?: () => void;            // 完成回调
  onFragmentUpdate?: (fragments: Fragment[]) => void;
}
```

## 🧪 测试

```bash
# 运行 Core 包测试
cd packages/core
npm test

# 运行 React 包测试
cd packages/react
npm test
```

## 📄 许可证

MIT License

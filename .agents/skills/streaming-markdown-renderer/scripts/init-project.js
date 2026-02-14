#!/usr/bin/env node

/**
 * Streaming Markdown Renderer 项目初始化脚本
 */

const fs = require('fs');
const path = require('path');

const projectName = process.argv[2] || 'streaming-markdown-app';
const projectDir = path.resolve(process.cwd(), projectName);

console.log(`🚀 初始化 Streaming Markdown Renderer 项目: ${projectName}\n`);

// 创建目录结构
const dirs = [
  'packages/core/src/utils',
  'packages/react/src/hooks',
  'packages/react/src/components',
  'apps/demo/src',
];

dirs.forEach(dir => {
  fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
});

// 创建 package.json 文件
fs.writeFileSync(
  path.join(projectDir, 'package.json'),
  JSON.stringify({
    name: projectName,
    private: true,
    workspaces: ['packages/*', 'apps/*'],
    scripts: {
      build: 'npm run build --workspaces',
      dev: 'npm run dev -w demo',
    },
  }, null, 2)
);

fs.writeFileSync(
  path.join(projectDir, 'packages/core/package.json'),
  JSON.stringify({
    name: '@streaming-markdown/core',
    version: '0.1.0',
    type: 'module',
    main: './dist/index.js',
    scripts: { build: 'tsc' },
  }, null, 2)
);

fs.writeFileSync(
  path.join(projectDir, 'packages/core/tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      strict: true,
      declaration: true,
      outDir: './dist',
      rootDir: './src',
    },
  }, null, 2)
);

// 创建核心类型文件
fs.writeFileSync(
  path.join(projectDir, 'packages/core/src/types.ts'),
  `export type FragmentType = 'heading' | 'paragraph' | 'codeblock' | 'list' | 'image';

export interface Fragment {
  key: string;
  type: FragmentType;
  rawContent: string;
  isComplete: boolean;
  data: unknown;
}

export interface ParserOptions {
  hashAlgorithm?: 'murmur3' | 'djb2';
}`
);

// 创建 hash 工具
fs.writeFileSync(
  path.join(projectDir, 'packages/core/src/utils/hash.ts'),
  `export function murmurHash3(str: string, seed = 0): string {
  let h1 = seed;
  for (let i = 0; i < str.length; i++) {
    let k1 = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ k1, 0x5bd1e995);
    h1 = Math.imul(h1 ^ (h1 >>> 15), 0x5bd1e995);
  }
  return (h1 >>> 0).toString(16);
}`
);

// 创建核心解析器
fs.writeFileSync(
  path.join(projectDir, 'packages/core/src/parser.ts'),
  `import { murmurHash3 } from './utils/hash.js';
import type { Fragment, FragmentType, ParserOptions } from './types.js';

export class StreamingParser {
  private buffer = '';
  private fragments: Fragment[] = [];
  private current: Fragment | null = null;

  appendChunk(chunk: string): void {
    this.buffer += chunk;
    this.parse();
  }

  private parse(): void {
    const lines = this.buffer.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLast = i === lines.length - 1;
      
      if (!this.current) {
        this.startFragment(line, isLast);
      } else {
        this.continueFragment(line, isLast);
      }
    }
  }

  private startFragment(line: string, isLast: boolean): void {
    if (!line.trim()) return;
    
    const type: FragmentType = line.startsWith('#') ? 'heading' : 
                               line.startsWith('\`\`\`') ? 'codeblock' : 'paragraph';
    
    const key = isLast 
      ? \`temp-\${this.fragments.length}-\${Date.now()}\`
      : \`frag-\${murmurHash3(line)}\`;
    
    this.current = {
      key,
      type,
      rawContent: line,
      isComplete: !isLast,
      data: { content: line },
    };
  }

  private continueFragment(line: string, isLast: boolean): void {
    if (this.current!.type === 'codeblock' && line === '\`\`\`' && !isLast) {
      this.current!.rawContent += line;
      this.current!.isComplete = true;
      this.fragments.push(this.current!);
      this.current = null;
    } else if (!line.trim() && !isLast) {
      this.current!.isComplete = true;
      this.fragments.push(this.current!);
      this.current = null;
    } else {
      this.current!.rawContent += '\n' + line;
    }
  }

  getFragments(): Fragment[] {
    return [...this.fragments, ...(this.current ? [this.current] : [])];
  }

  reset(): void {
    this.buffer = '';
    this.fragments = [];
    this.current = null;
  }
}`
);

fs.writeFileSync(
  path.join(projectDir, 'packages/core/src/index.ts'),
  `export { StreamingParser } from './parser.js';
export type { Fragment, ParserOptions } from './types.js';
export { murmurHash3 } from './utils/hash.js';`
);

// React 包
fs.writeFileSync(
  path.join(projectDir, 'packages/react/package.json'),
  JSON.stringify({
    name: '@streaming-markdown/react',
    version: '0.1.0',
    type: 'module',
    dependencies: { '@streaming-markdown/core': 'workspace:*', react: '^18.0.0' },
    devDependencies: { '@types/react': '^18.0.0', typescript: '^5.0.0', vite: '^5.0.0' },
  }, null, 2)
);

fs.writeFileSync(
  path.join(projectDir, 'packages/react/tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      jsx: 'react-jsx',
      strict: true,
      declaration: true,
      outDir: './dist',
    },
  }, null, 2)
);

fs.writeFileSync(
  path.join(projectDir, 'packages/react/src/hooks/useStreamingParser.ts'),
  `import { useState, useEffect, useMemo, useRef } from 'react';
import { StreamingParser } from '@streaming-markdown/core';
import type { Fragment, ParserOptions } from '@streaming-markdown/core';

export function useStreamingParser(content: string, options?: ParserOptions) {
  const parser = useMemo(() => new StreamingParser(options), []);
  const lastLen = useRef(0);
  const [fragments, setFragments] = useState<Fragment[]>([]);

  useEffect(() => {
    if (content.length > lastLen.current) {
      parser.appendChunk(content.slice(lastLen.current));
      setFragments(parser.getFragments());
      lastLen.current = content.length;
    }
  }, [content, parser]);

  return fragments;
}`
);

fs.writeFileSync(
  path.join(projectDir, 'packages/react/src/components/StreamingMarkdown.tsx'),
  `import React, { memo } from 'react';
import { useStreamingParser } from '../hooks/useStreamingParser.js';
import type { Fragment } from '@streaming-markdown/core';

interface Props {
  content: string;
}

const FragmentRenderer = memo(({ fragment }: { fragment: Fragment }) => {
  const data = fragment.data as { content?: string };
  if (fragment.type === 'heading') {
    return <h1>{data.content}</h1>;
  }
  if (fragment.type === 'codeblock') {
    return <pre><code>{data.content}</code></pre>;
  }
  return <p>{data.content}</p>;
}, (p, n) => p.fragment.key === n.fragment.key);

export function StreamingMarkdown({ content }: Props) {
  const fragments = useStreamingParser(content);
  return (
    <div className="streaming-markdown">
      {fragments.map(f => <FragmentRenderer key={f.key} fragment={f} />)}
    </div>
  );
}`
);

fs.writeFileSync(
  path.join(projectDir, 'packages/react/src/index.ts'),
  `export { StreamingMarkdown } from './components/StreamingMarkdown.js';
export { useStreamingParser } from './hooks/useStreamingParser.js';`
);

// Demo app
fs.writeFileSync(
  path.join(projectDir, 'apps/demo/package.json'),
  JSON.stringify({
    name: 'demo',
    private: true,
    dependencies: {
      '@streaming-markdown/react': 'workspace:*',
      react: '^18.0.0',
      'react-dom': '^18.0.0',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.0.0',
      vite: '^5.0.0',
    },
  }, null, 2)
);

fs.writeFileSync(
  path.join(projectDir, 'apps/demo/src/App.tsx'),
  `import { useState, useEffect } from 'react';
import { StreamingMarkdown } from '@streaming-markdown/react';

const STREAM = [
  '# Hello\\n\\n',
  'Streaming **Markdown**',
  '\\n\\n\`\`\`\\nconst x = 1;\\n\`\`\`\\n\\n',
  'Done!',
];

export default function App() {
  const [content, setContent] = useState('');

  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      if (i < STREAM.length) setContent(c => c + STREAM[i++]);
      else clearInterval(t);
    }, 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <StreamingMarkdown content={content} />
    </div>
  );
}`
);

fs.writeFileSync(
  path.join(projectDir, 'apps/demo/src/main.tsx'),
  `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);`
);

fs.writeFileSync(
  path.join(projectDir, 'apps/demo/index.html'),
  `<!DOCTYPE html>
<html>
<head><title>Demo</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`
);

fs.writeFileSync(
  path.join(projectDir, 'apps/demo/vite.config.ts'),
  `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });`
);

// README
fs.writeFileSync(
  path.join(projectDir, 'README.md'),
  `# ${projectName}

流式 Markdown 渲染项目

## 快速开始

\`\`\`bash
cd ${projectName}
npm install
npm run dev
\`\`\`

## 项目结构

- packages/core: 核心解析器
- packages/react: React 组件  
- apps/demo: 演示应用`
);

console.log('✅ 项目创建成功！');
console.log(`\n下一步:\n  cd ${projectName}\n  npm install\n  npm run dev`);

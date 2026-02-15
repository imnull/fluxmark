/**
 * Streaming Markdown Vue
 *
 * Vue 3 组件库入口
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { StreamingMarkdown } from '@streaming-markdown/vue';
 * import '@streaming-markdown/vue/styles';
 *
 * const content = ref('# Hello World\n\nThis is a test.');
 * </script>
 *
 * <template>
 *   <StreamingMarkdown :content="content" />
 * </template>
 * ```
 */

// 主组件
export { StreamingMarkdown } from './components/StreamingMarkdown.js';
export { default } from './components/StreamingMarkdown.js';

// Composable
export {
  useStreamingParser,
  useStreamingParserReactive,
} from './composables/useStreamingParser.js';

// 渲染器组件（可单独使用或自定义）
export {
  HeadingRenderer,
  ParagraphRenderer,
  CodeBlockRenderer,
  ListRenderer,
  ListItemRenderer,
  BlockquoteRenderer,
  ImageRenderer,
  ThematicBreakRenderer,
  IncompleteRenderer,
  defaultComponents,
} from './components/FragmentRenderers.js';

// 类型
export type {
  // Fragment 类型
  Fragment,
  ParserOptions,
  // 组件 Props
  StreamingMarkdownProps,
  UseStreamingParserReturn,
  BaseFragmentProps,
  HeadingProps,
  ParagraphProps,
  CodeBlockProps,
  CodeLine,
  ListProps,
  ListItemProps,
  ListItem,
  BlockquoteProps,
  ImageProps,
  ThematicBreakProps,
  IncompleteProps,
  // 高亮
  HighlightFunction,
  HighlightOptions,
  // 组件映射
  ComponentMap,
  // Vue 插槽
  FragmentSlots,
} from './types/index.js';

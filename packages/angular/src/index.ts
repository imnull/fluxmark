/**
 * Streaming Markdown Angular
 *
 * Angular 组件库入口
 *
 * @example
 * ```typescript
 * import { StreamingMarkdownComponent } from '@streaming-markdown/angular';
 *
 * @Component({
 *   template: `<streaming-markdown [content]="content" />`,
 *   imports: [StreamingMarkdownComponent],
 * })
 * export class MyComponent {
 *   content = '# Hello World';
 * }
 * ```
 */

// 主组件
export { StreamingMarkdownComponent } from './components/streaming-markdown.component.js';

// 服务
export { StreamingParserService } from './services/streaming-parser.service.js';

// 渲染器组件
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
  FRAGMENT_RENDERERS,
} from './components/fragment-renderers.js';

// 类型
export type {
  Fragment,
  ParserOptions,
  StreamingMarkdownInputs,
  StreamingMarkdownOutputs,
  BaseFragmentInputs,
  HeadingInputs,
  ParagraphInputs,
  CodeBlockInputs,
  CodeLine,
  ListInputs,
  ListItemInputs,
  ListItem,
  BlockquoteInputs,
  ImageInputs,
  ThematicBreakInputs,
  IncompleteInputs,
  HighlightFunction,
  HighlightOptions,
} from './types/index.js';

// 状态类型
export type { StreamingParserState } from './services/streaming-parser.service.js';

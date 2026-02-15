/**
 * Fragment 渲染器组件
 *
 * 各类型分片的 Vue 渲染实现，使用 memo 优化防止不必要的重渲染
 */

import {
  defineComponent,
  h,
  ref,
  watch,
  computed,
  type PropType,
} from 'vue';
import type {
  HighlightFunction,
  CodeLine,
  ListItem,
} from '../types/index.js';
import type { Fragment } from '@streaming-markdown/core';

// ===== 工具函数 =====

/**
 * 简单的行内标记解析
 */
function processInlineMarkdown(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

// ===== Heading 渲染器 =====

export const HeadingRenderer = defineComponent({
  name: 'HeadingRenderer',
  props: {
    fragment: { type: Object as PropType<Fragment>, required: true },
    isStreaming: { type: Boolean, default: false },
    level: { type: Number, required: true },
    content: { type: String, required: true },
  },
  setup(props) {
    return () =>
      h(
        `h${props.level}` as keyof HTMLElementTagNameMap,
        {
          class: [`md-heading`, `md-h${props.level}`],
        },
        props.content
      );
  },
});

// ===== Paragraph 渲染器 =====

export const ParagraphRenderer = defineComponent({
  name: 'ParagraphRenderer',
  props: {
    fragment: { type: Object as PropType<Fragment>, required: true },
    isStreaming: { type: Boolean, default: false },
    content: { type: String, required: true },
    hasInlineImages: { type: Boolean, default: false },
  },
  setup(props) {
    const processedContent = computed(() =>
      processInlineMarkdown(props.content)
    );

    return () =>
      h('p', {
        class: 'md-paragraph',
        innerHTML: processedContent.value,
      });
  },
});

// ===== CodeBlock 渲染器 =====

export const CodeBlockRenderer = defineComponent({
  name: 'CodeBlockRenderer',
  props: {
    fragment: { type: Object as PropType<Fragment>, required: true },
    isStreaming: { type: Boolean, default: false },
    lang: { type: String, default: '' },
    code: { type: String, default: '' },
    lines: { type: Array as PropType<CodeLine[]>, default: () => [] },
    highlight: { type: Function as PropType<HighlightFunction>, default: undefined },
  },
  setup(props) {
    const highlightedCode = ref('');
    const isHighlighting = ref(false);

    // 监听代码变化进行高亮
    watch(
      () => [props.fragment.isComplete, props.code, props.lang, props.highlight] as const,
      ([isComplete, code, lang, highlight]) => {
        if (isComplete && highlight && code) {
          isHighlighting.value = true;
          Promise.resolve(highlight(code, lang))
            .then((html) => {
              highlightedCode.value = html;
              isHighlighting.value = false;
            })
            .catch(() => {
              isHighlighting.value = false;
            });
        }
      },
      { immediate: true }
    );

    return () => {
      // 如果有行级数据且代码未完成，按行渲染
      if (props.lines && props.lines.length > 0 && !props.fragment.isComplete) {
        return h(
          'pre',
          { class: 'md-codeblock md-codeblock-streaming' },
          h(
            'code',
            { class: props.lang ? `language-${props.lang}` : undefined },
            props.lines.map((line, index) =>
              h(
                'div',
                {
                  key: index,
                  class: [
                    'md-code-line',
                    line.isComplete ? 'md-complete' : 'md-incomplete',
                  ],
                  'data-line-number': line.lineNumber,
                },
                line.content
              )
            )
          )
        );
      }

      // 完成的代码块
      return h(
        'pre',
        { class: 'md-codeblock' },
        [
          h('code', {
            class: props.lang ? `language-${props.lang}` : undefined,
            innerHTML: highlightedCode.value || undefined,
          }, highlightedCode.value ? undefined : props.code),
          isHighlighting.value
            ? h('span', { class: 'md-highlighting-indicator' })
            : null,
        ]
      );
    };
  },
});

// ===== List 渲染器 =====

export const ListRenderer = defineComponent({
  name: 'ListRenderer',
  props: {
    fragment: { type: Object as PropType<Fragment>, required: true },
    isStreaming: { type: Boolean, default: false },
    ordered: { type: Boolean, default: false },
    items: { type: Array as PropType<ListItem[]>, default: () => [] },
  },
  setup(props, { slots }) {
    return () =>
      h(
        props.ordered ? 'ol' : 'ul',
        {
          class: [
            'md-list',
            props.ordered ? 'md-ordered-list' : 'md-unordered-list',
          ],
        },
        slots.default ? slots.default() : []
      );
  },
});

// ===== ListItem 渲染器 =====

export const ListItemRenderer = defineComponent({
  name: 'ListItemRenderer',
  props: {
    fragment: { type: Object as PropType<Fragment>, required: true },
    isStreaming: { type: Boolean, default: false },
    item: { type: Object as PropType<ListItem>, required: true },
    index: { type: Number, default: 0 },
  },
  setup(props) {
    return () =>
      h(
        'li',
        {
          class: [
            'md-list-item',
            props.item.checked !== undefined ? 'md-task-item' : '',
          ],
        },
        [
          props.item.checked !== undefined
            ? h('input', {
                type: 'checkbox',
                checked: props.item.checked,
                readOnly: true,
                class: 'md-task-checkbox',
              })
            : null,
          props.item.content,
        ]
      );
  },
});

// ===== Blockquote 渲染器 =====

export const BlockquoteRenderer = defineComponent({
  name: 'BlockquoteRenderer',
  props: {
    fragment: { type: Object as PropType<Fragment>, required: true },
    isStreaming: { type: Boolean, default: false },
    content: { type: String, required: true },
    level: { type: Number, default: 1 },
  },
  setup(props) {
    return () =>
      h(
        'blockquote',
        {
          class: ['md-blockquote', `md-blockquote-level-${props.level}`],
        },
        h('p', props.content)
      );
  },
});

// ===== Image 渲染器（重点优化：防止闪烁）=====

export const ImageRenderer = defineComponent({
  name: 'ImageRenderer',
  props: {
    fragment: { type: Object as PropType<Fragment>, required: true },
    isStreaming: { type: Boolean, default: false },
    src: { type: String, required: true },
    alt: { type: String, default: '' },
    title: { type: String, default: undefined },
    href: { type: String, default: undefined },
  },
  setup(props) {
    const isLoaded = ref(false);
    const hasError = ref(false);

    // 预加载图片
    const preloadImage = () => {
      const img = new Image();
      img.src = props.src;
      img.onload = () => {
        isLoaded.value = true;
      };
      img.onerror = () => {
        hasError.value = true;
      };
    };

    // 监听 src 变化
    watch(
      () => props.src,
      () => {
        isLoaded.value = false;
        hasError.value = false;
        preloadImage();
      },
      { immediate: true }
    );

    return () => {
      const imageElement = hasError.value
        ? h(
            'div',
            {
              style: {
                padding: '20px',
                background: '#f5f5f5',
                border: '1px dashed #ccc',
                borderRadius: '4px',
                textAlign: 'center',
                color: '#666',
              },
            },
            [
              h('div', { style: { fontSize: '24px', marginBottom: '8px' } }, '🖼️'),
              h(
                'div',
                { style: { fontSize: '14px' } },
                props.alt || '图片加载失败'
              ),
              h(
                'div',
                {
                  style: {
                    fontSize: '12px',
                    color: '#999',
                    marginTop: '4px',
                  },
                },
                `${props.src.slice(0, 50)}...`
              ),
            ]
          )
        : h('img', {
            src: props.src,
            alt: props.alt,
            title: props.title,
            loading: 'lazy',
            class: ['md-image', isLoaded.value ? 'md-loaded' : 'md-loading'],
            style: {
              opacity: isLoaded.value ? 1 : 0.5,
              transition: 'opacity 0.3s ease',
              minHeight: '100px',
              background: '#f0f0f0',
            },
            onLoad: () => {
              isLoaded.value = true;
            },
            onError: () => {
              hasError.value = true;
            },
          });

      const content = h(
        'figure',
        {
          class: [
            'md-image-wrapper',
            hasError.value ? 'md-image-error' : '',
          ],
        },
        [
          imageElement,
          props.alt
            ? h('figcaption', { class: 'md-image-caption' }, props.alt)
            : null,
        ]
      );

      // 如果有链接，包裹在 <a> 标签中
      if (props.href) {
        return h(
          'a',
          {
            href: props.href,
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'md-image-link',
            style: { textDecoration: 'none' },
          },
          content
        );
      }

      return content;
    };
  },
});

// ===== ThematicBreak 渲染器 =====

export const ThematicBreakRenderer = defineComponent({
  name: 'ThematicBreakRenderer',
  props: {
    fragment: { type: Object as PropType<Fragment>, required: true },
    isStreaming: { type: Boolean, default: false },
  },
  setup() {
    return () => h('hr', { class: 'md-hr' });
  },
});

// ===== Incomplete 渲染器（流式未完成状态）=====

export const IncompleteRenderer = defineComponent({
  name: 'IncompleteRenderer',
  props: {
    fragment: { type: Object as PropType<Fragment>, required: true },
    isStreaming: { type: Boolean, default: false },
    partialType: { type: String, default: '' },
    accumulatedContent: { type: String, default: '' },
  },
  setup(props) {
    return () => {
      const cursor = h('span', { class: 'md-cursor' }, '▋');

      // 根据 partialType 显示预览
      if (props.partialType === 'paragraph') {
        return h(
          'div',
          { class: 'md-incomplete md-pending' },
          h(
            'p',
            { class: 'md-paragraph md-incomplete-content' },
            [props.accumulatedContent, cursor]
          )
        );
      }

      if (props.partialType === 'codeblock') {
        return h(
          'div',
          { class: 'md-incomplete md-pending' },
          h(
            'pre',
            { class: 'md-codeblock md-incomplete-content' },
            h('code', props.accumulatedContent)
          )
        );
      }

      // 其他类型显示原始内容
      return h(
        'div',
        { class: 'md-incomplete md-pending' },
        h(
          'div',
          { class: 'md-raw md-incomplete-content' },
          [props.accumulatedContent, cursor]
        )
      );
    };
  },
});

// ===== 导出所有渲染器 =====

export const defaultComponents = {
  heading: HeadingRenderer,
  paragraph: ParagraphRenderer,
  codeblock: CodeBlockRenderer,
  list: ListRenderer,
  listItem: ListItemRenderer,
  blockquote: BlockquoteRenderer,
  image: ImageRenderer,
  thematicBreak: ThematicBreakRenderer,
  incomplete: IncompleteRenderer,
};

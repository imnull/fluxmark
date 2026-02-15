/**
 * StreamingMarkdown 主组件
 *
 * 流式 Markdown 渲染的 Vue 组件
 */

import {
  defineComponent,
  h,
  ref,
  watch,
  computed,
  shallowRef,
  type PropType,
  type VNode,
  type Component,
} from 'vue';
import { StreamingParser } from '@streaming-markdown/core';
import type { Fragment, ParserOptions } from '@streaming-markdown/core';
import { defaultComponents } from './FragmentRenderers.js';
import type { ComponentMap } from '../types/index.js';

export const StreamingMarkdown = defineComponent({
  name: 'StreamingMarkdown',
  props: {
    /** 当前累积的 Markdown 内容 */
    content: {
      type: String,
      required: true,
    },
    /** 解析器配置 */
    options: {
      type: Object as PropType<ParserOptions>,
      default: undefined,
    },
    /** 自定义渲染组件 */
    components: {
      type: Object as PropType<Partial<ComponentMap>>,
      default: undefined,
    },
    /** 容器 CSS 类名 */
    class: {
      type: String,
      default: undefined,
    },
  },
  emits: {
    /** 所有分片完成时触发 */
    complete: () => true,
    /** 分片更新时触发 */
    fragmentUpdate: (_fragments: Fragment[]) => true,
  },
  setup(props, { emit, expose }) {
    // Parser 实例
    const parser = shallowRef<StreamingParser | null>(null);

    // 记录上次内容长度
    const lastLength = ref(0);

    // 分片状态
    const fragments = ref<Fragment[]>([]);

    // 流式状态
    const isStreaming = ref(false);

    // 完成状态
    const isComplete = ref(false);

    // 防抖定时器
    let streamingTimer: ReturnType<typeof setTimeout> | null = null;

    // 初始化 Parser
    if (!parser.value) {
      parser.value = new StreamingParser(props.options);
    }

    // 合并组件
    const mergedComponents = computed(
      () => ({ ...defaultComponents, ...props.components }) as Record<
        string,
        Component
      >
    );

    // 处理内容变化
    const processContent = (newContent: string) => {
      const currentLength = newContent.length;
      const prevLength = lastLength.value;

      if (
        currentLength >= prevLength &&
        newContent.startsWith(newContent.slice(0, prevLength))
      ) {
        // 追加模式
        const newChunk = newContent.slice(prevLength);

        if (newChunk) {
          isStreaming.value = true;
          parser.value!.appendChunk(newChunk);
          fragments.value = [...parser.value!.getFragments()];
          lastLength.value = currentLength;

          // 防抖
          if (streamingTimer) {
            clearTimeout(streamingTimer);
          }
          streamingTimer = setTimeout(() => {
            isStreaming.value = false;
          }, 100);
        }
      } else {
        // 重置模式
        parser.value!.reset();
        lastLength.value = 0;

        if (newContent) {
          parser.value!.appendChunk(newContent);
          lastLength.value = newContent.length;
        }

        fragments.value = [...parser.value!.getFragments()];
      }

      // 更新完成状态
      const wasComplete = isComplete.value;
      isComplete.value = fragments.value.every((f) => f.isComplete);

      // 触发事件
      emit('fragmentUpdate', fragments.value);

      if (isComplete.value && !wasComplete) {
        emit('complete');
      }
    };

    // 监听内容变化
    watch(
      () => props.content,
      (newContent) => {
        processContent(newContent);
      },
      { immediate: true }
    );

    // 监听 options 变化，重置 parser
    watch(
      () => props.options,
      (newOptions) => {
        parser.value = new StreamingParser(newOptions);
        lastLength.value = 0;
        fragments.value = [];
        isComplete.value = false;
        if (props.content) {
          processContent(props.content);
        }
      },
      { deep: true }
    );

    // 重置方法
    const reset = () => {
      parser.value?.reset();
      lastLength.value = 0;
      fragments.value = [];
      isStreaming.value = false;
      isComplete.value = false;
    };

    // 最终化方法
    const finalize = () => {
      const result = parser.value?.finalize() || [];
      fragments.value = [...result];
      isComplete.value = true;
      return result;
    };

    // 暴露方法
    expose({
      reset,
      finalize,
      getFragments: () => fragments.value,
      getIsComplete: () => isComplete.value,
      getIsStreaming: () => isStreaming.value,
    });

    // 渲染单个 Fragment
    const renderFragment = (fragment: Fragment): VNode => {
      const component = mergedComponents.value[fragment.type];

      if (!component) {
        // 未知类型，显示原始内容
        return h(
          'div',
          { key: fragment.key, class: 'md-unknown' },
          fragment.rawContent
        );
      }

      // 根据 fragment 类型提取数据
      const componentProps: Record<string, unknown> = {
        fragment,
        isStreaming: isStreaming.value,
      };

      switch (fragment.type) {
        case 'heading': {
          const data = fragment.data as { level: number; content: string };
          Object.assign(componentProps, data);
          break;
        }
        case 'paragraph': {
          const data = fragment.data as {
            content: string;
            hasInlineImages?: boolean;
          };
          Object.assign(componentProps, data);
          break;
        }
        case 'codeblock': {
          const data = fragment.data as {
            lang: string;
            code: string;
            lines?: { content: string; lineNumber: number; isComplete: boolean }[];
          };
          Object.assign(componentProps, data);
          break;
        }
        case 'list': {
          const data = fragment.data as { ordered: boolean; items: unknown[] };
          Object.assign(componentProps, data);
          break;
        }
        case 'blockquote': {
          const data = fragment.data as { content: string; level: number };
          Object.assign(componentProps, data);
          break;
        }
        case 'image': {
          const data = fragment.data as {
            src: string;
            alt: string;
            title?: string;
            href?: string;
          };
          Object.assign(componentProps, data);
          break;
        }
        case 'incomplete': {
          const data = fragment.data as {
            partialType: string;
            accumulatedContent: string;
          };
          Object.assign(componentProps, data);
          break;
        }
      }

      return h(component, {
        key: fragment.key,
        ...componentProps,
      });
    };

    return () => {
      const containerClasses = [
        'streaming-markdown',
        isStreaming.value ? 'md-streaming' : 'md-complete',
        props.class || '',
      ].filter(Boolean);

      return h(
        'div',
        { class: containerClasses },
        fragments.value.map(renderFragment)
      );
    };
  },
});

// 默认导出
export default StreamingMarkdown;

/**
 * useStreamingParser Composable
 *
 * 将 StreamingParser 与 Vue 响应式状态管理集成
 */

import { ref, watch, shallowRef, readonly, type Raw, type Ref } from 'vue';
import { StreamingParser } from '@streaming-markdown/core';
import type { Fragment, ParserOptions } from '@streaming-markdown/core';
import type { UseStreamingParserReturn } from '../types/index.js';

/**
 * 流式解析器 Composable
 *
 * @param content - 响应式的 Markdown 内容
 * @param options - 解析器选项
 * @returns 解析状态
 */
export function useStreamingParser(
  content: Ref<string> | string,
  options?: ParserOptions
): UseStreamingParserReturn {
  // Parser 实例（使用 shallowRef 避免深度响应）
  const parser = shallowRef<StreamingParser | null>(null);

  // 记录上次内容长度
  const lastLength = ref(0);

  // 分片状态（使用 shallowRef 优化大数组性能）
  const fragments = ref<Raw<Fragment[]>>([] as unknown as Raw<Fragment[]>);

  // 流式状态
  const isStreaming = ref(false);

  // 防抖定时器
  let streamingTimer: ReturnType<typeof setTimeout> | null = null;

  // 初始化 Parser
  if (!parser.value) {
    parser.value = new StreamingParser(options);
  }

  // 处理内容变化
  const processContent = (newContent: string) => {
    const currentLength = newContent.length;
    const prevLength = lastLength.value;

    // 检测是追加还是重置
    if (
      currentLength >= prevLength &&
      newContent.startsWith(newContent.slice(0, prevLength))
    ) {
      // 追加模式：只处理新增部分
      const newChunk = newContent.slice(prevLength);

      if (newChunk) {
        // 标记为流式状态
        isStreaming.value = true;

        // 追加到 Parser
        parser.value!.appendChunk(newChunk);

        // 获取更新后的分片
        fragments.value = [...parser.value!.getFragments()] as unknown as Raw<Fragment[]>;

        // 更新记录
        lastLength.value = currentLength;

        // 防抖：100ms 后认为流式结束
        if (streamingTimer) {
          clearTimeout(streamingTimer);
        }
        streamingTimer = setTimeout(() => {
          isStreaming.value = false;
        }, 100);
      }
    } else if (currentLength < prevLength || !newContent.startsWith(newContent.slice(0, prevLength))) {
      // 重置模式：内容被清空或替换
      parser.value!.reset();
      lastLength.value = 0;

      if (newContent) {
        parser.value!.appendChunk(newContent);
        lastLength.value = newContent.length;
      }

      fragments.value = [...parser.value!.getFragments()] as unknown as Raw<Fragment[]>;
    }
  };

  // 监听内容变化
  watch(
    () => (typeof content === 'string' ? content : content.value),
    (newContent) => {
      processContent(newContent);
    },
    { immediate: true }
  );

  // 计算是否全部完成
  const isComplete = readonly(
    ref(
      fragments.value.every((f: Fragment) => f.isComplete)
    )
  );

  // 监听 fragments 变化更新 isComplete
  watch(
    fragments,
    (newFragments) => {
      (isComplete as Ref<boolean>).value = newFragments.every(
        (f: Fragment) => f.isComplete
      );
    },
    { deep: false }
  );

  return {
    fragments: fragments.value,
    isComplete: isComplete.value,
    isStreaming: isStreaming.value,
  };
}

/**
 * 带响应式返回的流式解析器
 *
 * @param content - 响应式的 Markdown 内容
 * @param options - 解析器选项
 * @returns 响应式解析状态
 */
export function useStreamingParserReactive(
  content: Ref<string>,
  options?: ParserOptions
): {
  fragments: Ref<Fragment[]>;
  isComplete: Ref<boolean>;
  isStreaming: Ref<boolean>;
} {
  const parser = shallowRef<StreamingParser | null>(null);
  const lastLength = ref(0);
  const fragments = ref<Fragment[]>([]);
  const isStreaming = ref(false);
  const isComplete = ref(false);

  let streamingTimer: ReturnType<typeof setTimeout> | null = null;

  // 初始化 Parser
  if (!parser.value) {
    parser.value = new StreamingParser(options);
  }

  // 监听内容变化
  watch(
    content,
    (newContent) => {
      const currentLength = newContent.length;
      const prevLength = lastLength.value;

      if (
        currentLength >= prevLength &&
        newContent.startsWith(newContent.slice(0, prevLength))
      ) {
        const newChunk = newContent.slice(prevLength);

        if (newChunk) {
          isStreaming.value = true;
          parser.value!.appendChunk(newChunk);
          fragments.value = [...parser.value!.getFragments()];
          lastLength.value = currentLength;

          if (streamingTimer) {
            clearTimeout(streamingTimer);
          }
          streamingTimer = setTimeout(() => {
            isStreaming.value = false;
          }, 100);
        }
      } else {
        parser.value!.reset();
        lastLength.value = 0;

        if (newContent) {
          parser.value!.appendChunk(newContent);
          lastLength.value = newContent.length;
        }

        fragments.value = [...parser.value!.getFragments()];
      }

      // 更新完成状态
      isComplete.value = fragments.value.every((f) => f.isComplete);
    },
    { immediate: true }
  );

  return {
    fragments,
    isComplete,
    isStreaming,
  };
}

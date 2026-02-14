/**
 * useStreamingParser Hook
 * 
 * 将 StreamingParser 与 React 状态管理集成
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { StreamingParser } from '@streaming-markdown/core';
import type { Fragment, ParserOptions } from '@streaming-markdown/core';
import type { UseStreamingParserReturn } from '../types/index.js';

export function useStreamingParser(
  content: string,
  options?: ParserOptions
): UseStreamingParserReturn {
  // Parser 实例（持久化）
  const parserRef = useRef<StreamingParser | null>(null);
  
  // 记录上次内容长度，用于计算增量
  const lastLengthRef = useRef(0);
  
  // 分片状态
  const [fragments, setFragments] = useState<Fragment[]>([]);
  
  // 流式状态
  const [isStreaming, setIsStreaming] = useState(false);
  
  // 防抖定时器
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 创建或获取 Parser 实例
  const parser = useMemo(() => {
    if (!parserRef.current) {
      parserRef.current = new StreamingParser(options);
    }
    return parserRef.current;
  }, []); // Parser 实例只创建一次

  // 处理内容变化
  useEffect(() => {
    const currentLength = content.length;
    const lastLength = lastLengthRef.current;

    // 检测是追加还是重置
    if (currentLength >= lastLength && content.startsWith(content.slice(0, lastLength))) {
      // 追加模式：只处理新增部分
      const newChunk = content.slice(lastLength);
      
      if (newChunk) {
        // 标记为流式状态
        setIsStreaming(true);
        
        // 追加到 Parser
        parser.appendChunk(newChunk);
        
        // 获取更新后的分片
        const newFragments = [...parser.getFragments()] as Fragment[];
        setFragments(newFragments);
        
        // 更新记录
        lastLengthRef.current = currentLength;
        
        // 防抖：100ms 后认为流式结束
        if (streamingTimerRef.current) {
          clearTimeout(streamingTimerRef.current);
        }
        streamingTimerRef.current = setTimeout(() => {
          setIsStreaming(false);
        }, 100);
      }
    } else if (currentLength < lastLength) {
      // 重置模式：内容被清空或替换
      parser.reset();
      lastLengthRef.current = 0;
      
      if (content) {
        parser.appendChunk(content);
        lastLengthRef.current = content.length;
      }
      
      setFragments([...parser.getFragments()] as Fragment[]);
    }

    // 清理定时器
    return () => {
      if (streamingTimerRef.current) {
        clearTimeout(streamingTimerRef.current);
      }
    };
  }, [content, parser]);

  // 计算是否全部完成
  const isComplete = useMemo(() => {
    return fragments.every(f => f.isComplete);
  }, [fragments]);

  return {
    fragments,
    isComplete,
    isStreaming,
  };
}

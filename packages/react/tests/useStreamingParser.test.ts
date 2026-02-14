/**
 * useStreamingParser Hook 测试
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStreamingParser } from '../src/index.js';

describe('useStreamingParser', () => {
  it('should return empty fragments initially', () => {
    const { result } = renderHook(() => useStreamingParser(''));
    expect(result.current.fragments).toHaveLength(0);
    expect(result.current.isComplete).toBe(true);
  });

  it('should parse content', () => {
    const { result } = renderHook(() => 
      useStreamingParser('# Hello\n\nWorld\n\n')
    );
    expect(result.current.fragments).toHaveLength(2);
    expect(result.current.fragments[0].type).toBe('heading');
    expect(result.current.fragments[1].type).toBe('paragraph');
  });

  it('should mark complete when all fragments are complete', () => {
    const { result } = renderHook(() => 
      useStreamingParser('Complete paragraph.\n\n')
    );
    expect(result.current.isComplete).toBe(true);
    expect(result.current.fragments.every(f => f.isComplete)).toBe(true);
  });
});

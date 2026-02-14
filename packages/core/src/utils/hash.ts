/**
 * Hash 工具函数
 * 用于生成分片的稳定 key
 */

/**
 * MurmurHash3 算法实现（32-bit）
 * 快速、分布均匀的字符串 hash
 * 
 * @param key 输入字符串
 * @param seed 随机种子（默认 0）
 * @returns 8 位十六进制字符串
 */
export function murmurHash3(key: string, seed: number = 0): string {
  const remainder = key.length & 3; // key.length % 4
  const bytes = key.length - remainder;
  
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  
  let h1 = seed;
  let i = 0;
  
  // 处理 4 字节一组的数据
  while (i < bytes) {
    let k1 = 
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);
    
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17); // ROTL32(k1, 15)
    k1 = Math.imul(k1, c2);
    
    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19); // ROTL32(h1, 13)
    h1 = Math.imul(h1, 5) + 0xe6546b64;
    
    i += 4;
  }
  
  // 处理剩余字节
  let k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
      k1 ^= key.charCodeAt(i) & 0xff;
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
      break;
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
      k1 ^= key.charCodeAt(i) & 0xff;
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
      break;
    case 1:
      k1 ^= key.charCodeAt(i) & 0xff;
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
      break;
  }
  
  // 最终化
  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;
  
  // 转为无符号 32 位整数，再转为 8 位十六进制
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

/**
 * djb2 hash 算法（备选）
 * 更简单快速，但分布性略差
 */
export function djb2(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) + key.charCodeAt(i); // hash * 33 + char
  }
  return (hash >>> 0).toString(16);
}

/**
 * 生成分片 key
 * 
 * 已完成分片：基于内容生成稳定 hash
 * 未完成分片：基于位置和时间戳生成临时 key
 */
export function generateFragmentKey(
  content: string,
  index: number,
  isComplete: boolean,
  algorithm: 'murmur3' | 'djb2' = 'murmur3'
): string {
  if (isComplete) {
    const hash = algorithm === 'murmur3' 
      ? murmurHash3(content) 
      : djb2(content);
    return `frag-${hash}`;
  } else {
    // 未完成分片使用临时 key
    return `temp-${index}-${content.length}-${Date.now()}`;
  }
}

/**
 * 生成代码行 key
 */
export function generateCodeLineKey(
  lineNumber: number,
  content: string,
  isComplete: boolean,
  algorithm: 'murmur3' | 'djb2' = 'murmur3'
): string {
  if (isComplete) {
    const hash = algorithm === 'murmur3'
      ? murmurHash3(content)
      : djb2(content);
    return `line-${lineNumber}-${hash}`;
  } else {
    return `line-${lineNumber}-temp-${Date.now()}`;
  }
}

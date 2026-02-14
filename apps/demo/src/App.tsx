import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StreamingMarkdown } from '@streaming-markdown/react';
import '@streaming-markdown/react/styles';
import { streamSimulator, demoContents } from './streamSimulator';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [speed, setSpeed] = useState(50); // 每个 chunk 的延迟（毫秒）
  const [selectedDemo, setSelectedDemo] = useState<string>('mixed');
  const [showSource, setShowSource] = useState(false); // 是否显示源码对照
  const abortRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 添加用户消息
  const addUserMessage = useCallback((content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  // 添加 AI 消息并开始流式输出
  const startAIStream = useCallback((content: string) => {
    const messageId = (Date.now() + 1).toString();
    
    setMessages(prev => [...prev, {
      id: messageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }]);
    
    setIsStreaming(true);

    // 启动流式模拟器
    const abort = streamSimulator({
      content,
      chunkDelay: speed,
      simulateJitter: true,
      onChunk: (chunk) => {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: msg.content + chunk }
            : msg
        ));
      },
      onComplete: () => {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, isStreaming: false }
            : msg
        ));
        setIsStreaming(false);
        abortRef.current = null;
      },
    });

    abortRef.current = abort;
  }, [speed]);

  // 停止流式输出
  const stopStream = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages(prev => prev.map(msg => 
      msg.isStreaming ? { ...msg, isStreaming: false } : msg
    ));
  }, []);

  // 清空对话
  const clearChat = useCallback(() => {
    stopStream();
    setMessages([]);
  }, [stopStream]);

  // 运行选中的演示
  const runDemo = useCallback(() => {
    if (isStreaming) return;
    
    const demoContent = demoContents[selectedDemo];
    if (!demoContent) return;

    // 添加用户提示
    addUserMessage(`演示：${demoContent.title}`);
    
    // 延迟一下再开始 AI 回复，模拟真实场景
    setTimeout(() => {
      startAIStream(demoContent.content);
    }, 300);
  }, [isStreaming, selectedDemo, addUserMessage, startAIStream]);

  // 手动发送消息
  const handleSendMessage = useCallback((content: string) => {
    if (!content.trim() || isStreaming) return;
    
    addUserMessage(content);
    
    // 模拟 AI 回复
    setTimeout(() => {
      const reply = `收到你的消息："${content}"\n\n这是一个示例回复，展示了流式渲染的效果。`;
      startAIStream(reply);
    }, 500);
  }, [isStreaming, addUserMessage, startAIStream]);

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <header style={styles.header}>
        <h1 style={styles.title}>🚀 Streaming Markdown Renderer</h1>
        <p style={styles.subtitle}>AI 对话流式渲染演示</p>
      </header>

      {/* 控制面板 */}
      <div style={styles.controlPanel}>
        <div style={styles.controlGroup}>
          <label style={styles.label}>演示内容：</label>
          <select 
            value={selectedDemo} 
            onChange={(e) => setSelectedDemo(e.target.value)}
            style={styles.select}
            disabled={isStreaming}
          >
            <option value="mixed">混合内容</option>
            <option value="code">代码展示</option>
            <option value="images">图片测试</option>
            <option value="long">长文本</option>
          </select>
        </div>

        <div style={styles.controlGroup}>
          <label style={styles.label}>速度：</label>
          <input
            type="range"
            min="10"
            max="200"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={styles.slider}
            disabled={isStreaming}
          />
          <span style={styles.speedLabel}>{speed}ms</span>
        </div>

        <div style={styles.controlGroup}>
          <label style={styles.label}>源码对照：</label>
          <button
            onClick={() => setShowSource(!showSource)}
            style={{
              ...styles.toggleButton,
              background: showSource ? '#667eea' : '#e9ecef',
              color: showSource ? 'white' : '#495057',
            }}
          >
            {showSource ? '✓ 开启' : '关闭'}
          </button>
        </div>

        <div style={styles.buttonGroup}>
          <button 
            onClick={runDemo}
            disabled={isStreaming}
            style={{
              ...styles.button,
              ...styles.primaryButton,
              opacity: isStreaming ? 0.5 : 1,
            }}
          >
            {isStreaming ? '渲染中...' : '运行演示'}
          </button>
          
          {isStreaming && (
            <button 
              onClick={stopStream}
              style={{ ...styles.button, ...styles.dangerButton }}
            >
              停止
            </button>
          )}
          
          <button 
            onClick={clearChat}
            disabled={isStreaming}
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              opacity: isStreaming ? 0.5 : 1,
            }}
          >
            清空
          </button>
        </div>
      </div>

      {/* 聊天区域 */}
      <div style={styles.chatContainer}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>💬</div>
            <p>选择一个演示或输入消息开始</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div 
            key={message.id}
            style={{
              ...styles.message,
              ...(message.role === 'user' ? styles.userMessage : styles.aiMessage),
            }}
          >
            <div style={styles.messageHeader}>
              <span style={styles.messageRole}>
                {message.role === 'user' ? '👤 用户' : '🤖 AI'}
              </span>
              {message.isStreaming && (
                <span style={styles.streamingIndicator}>● 输入中</span>
              )}
            </div>
            
            {message.role === 'assistant' ? (
              showSource ? (
                // 源码对照模式
                <div style={styles.sourceView}>
                  <div style={styles.sourcePanel}>
                    <div style={styles.sourceLabel}>📄 Markdown 源码</div>
                    <pre style={styles.sourceCode}>{message.content || '(空)'}</pre>
                  </div>
                  <div style={styles.divider} />
                  <div style={styles.renderPanel}>
                    <div style={styles.sourceLabel}>🎨 渲染结果</div>
                    <StreamingMarkdown 
                      content={message.content}
                      className="chat-message"
                    />
                  </div>
                </div>
              ) : (
                // 正常渲染模式
                <StreamingMarkdown 
                  content={message.content}
                  className="chat-message"
                />
              )
            ) : (
              <div style={styles.userContent}>{message.content}</div>
            )}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <form 
        style={styles.inputArea}
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
          handleSendMessage(input.value);
          input.value = '';
        }}
      >
        <input
          name="message"
          type="text"
          placeholder="输入消息..."
          disabled={isStreaming}
          style={styles.input}
        />
        <button 
          type="submit"
          disabled={isStreaming}
          style={{
            ...styles.sendButton,
            opacity: isStreaming ? 0.5 : 1,
          }}
        >
          发送
        </button>
      </form>
    </div>
  );
}

// 样式
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: '0 auto',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    boxShadow: '0 0 20px rgba(0,0,0,0.1)',
  },
  header: {
    padding: '20px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  controlPanel: {
    padding: '16px 24px',
    background: '#f8f9fa',
    borderBottom: '1px solid #e9ecef',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: '#495057',
  },
  select: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #ced4da',
    fontSize: 14,
    background: 'white',
    cursor: 'pointer',
  },
  slider: {
    width: 120,
  },
  speedLabel: {
    fontSize: 13,
    color: '#6c757d',
    minWidth: 50,
  },
  buttonGroup: {
    display: 'flex',
    gap: 8,
    marginLeft: 'auto',
  },
  button: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryButton: {
    background: '#667eea',
    color: 'white',
  },
  secondaryButton: {
    background: '#e9ecef',
    color: '#495057',
  },
  dangerButton: {
    background: '#dc3545',
    color: 'white',
  },
  toggleButton: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #ced4da',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  chatContainer: {
    flex: 1,
    overflow: 'auto',
    padding: 24,
    background: '#f5f5f5',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6c757d',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  message: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    maxWidth: '85%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  userMessage: {
    background: '#667eea',
    color: 'white',
    marginLeft: 'auto',
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    background: 'white',
    marginRight: 'auto',
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    fontSize: 13,
  },
  messageRole: {
    fontWeight: 600,
  },
  streamingIndicator: {
    color: '#28a745',
    fontSize: 12,
    animation: 'pulse 1s infinite',
  },
  userContent: {
    fontSize: 15,
    lineHeight: 1.5,
  },
  // 源码对照视图样式
  sourceView: {
    display: 'flex',
    gap: 16,
    flexDirection: 'row' as const,
  },
  sourcePanel: {
    flex: 1,
    minWidth: 0,
  },
  renderPanel: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    width: 1,
    background: '#e9ecef',
  },
  sourceLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6c757d',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  sourceCode: {
    margin: 0,
    padding: 12,
    background: '#f8f9fa',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    lineHeight: 1.5,
    overflow: 'auto',
    maxHeight: 400,
    border: '1px solid #e9ecef',
    color: '#333',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  },
  inputArea: {
    display: 'flex',
    gap: 12,
    padding: '16px 24px',
    background: 'white',
    borderTop: '1px solid #e9ecef',
  },
  input: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 8,
    border: '1px solid #ced4da',
    fontSize: 15,
    outline: 'none',
  },
  sendButton: {
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    background: '#667eea',
    color: 'white',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
  },
};

export default App;

'use client';

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-blue-600 text-xl">🏥</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Claim Assessment Agent</h2>
          <p className="text-gray-400 text-sm">
            Submit a claim for AI-powered assessment. Use the quick-start buttons below or describe
            your claim in detail.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {messages.map((msg, i) => (
        <MessageBubble
          key={i}
          role={msg.role}
          content={msg.content}
          isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

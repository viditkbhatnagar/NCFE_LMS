'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';

interface Thread {
  threadId: string;
  otherUser: { _id: string; name: string; email: string };
  lastMessage: { content: string; createdAt: string; senderId: string };
  unreadCount: number;
}

interface Message {
  _id: string;
  senderId: { _id: string; name: string };
  content: string;
  createdAt: string;
  attachmentUrl?: string;
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchThreads() {
      try {
        const res = await fetch('/api/messages');
        const data = await res.json();
        if (data.success) setThreads(data.data);
      } catch (error) {
        console.error('Failed to fetch threads:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchThreads();
  }, []);

  async function loadMessages(threadId: string) {
    setSelectedThread(threadId);
    try {
      const res = await fetch(`/api/messages/${threadId}`);
      const data = await res.json();
      if (data.success) setMessages(data.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedThread) return;

    const thread = threads.find((t) => t.threadId === selectedThread);
    if (!thread) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: thread.otherUser._id,
          content: newMessage,
          threadId: selectedThread,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.data]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Messages</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '60vh' }}>
        {/* Thread List */}
        <div className="lg:col-span-1">
          <Card padding="none" className="h-full">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Conversations</h2>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded-[6px] animate-pulse" />
                ))}
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-muted">No conversations yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {threads.map((thread) => (
                  <button
                    key={thread.threadId}
                    onClick={() => loadMessages(thread.threadId)}
                    className={`w-full text-left p-4 hover:bg-background transition-colors ${
                      selectedThread === thread.threadId ? 'bg-background' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-text-primary">{thread.otherUser.name}</span>
                      {thread.unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-primary text-white rounded-full">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate">{thread.lastMessage.content}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {new Date(thread.lastMessage.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Message View */}
        <div className="lg:col-span-2">
          <Card padding="none" className="h-full flex flex-col">
            {!selectedThread ? (
              <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                Select a conversation to view messages
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-text-primary">
                    {threads.find((t) => t.threadId === selectedThread)?.otherUser.name}
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '50vh' }}>
                  {messages.map((msg) => (
                    <div key={msg._id} className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-text-primary">{msg.senderId?.name}</span>
                        <span className="text-xs text-text-muted">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-background rounded-[6px] p-3 text-sm text-text-primary">
                        {msg.content}
                        {msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-2 text-xs text-primary hover:underline"
                          >
                            View Attachment
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="p-4 border-t border-border flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-border rounded-[6px] text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

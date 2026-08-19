import { axiosClient } from '@/lib/axiosClient';

export interface MessageReaction {
  id: string;
  emoji: string;
  user: { id: string; name: string };
}

export interface MessageAttachment {
  id: string;
  fileUrl: string;
  fileType: 'image' | 'file';
  fileName: string;
}

export interface MessageSender {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Message {
  id: string;
  channelId: string;
  content: string;
  senderId: string | null;
  sender?: MessageSender;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  isAiReply: boolean;
  aiServerName?: string;
  editedAt: string | null;
  createdAt: string;
}

export interface PaginatedMessages {
  items: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const messagesApi = {
  list: async (
    channelId: string,
    cursor?: string,
    limit = 50,
  ): Promise<PaginatedMessages> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    const { data } = await axiosClient.get<PaginatedMessages>(
      `/channels/${channelId}/messages?${params}`,
    );
    return data;
  },

  create: async (
    channelId: string,
    content: string,
  ): Promise<Message> => {
    const { data } = await axiosClient.post<Message>(
      `/channels/${channelId}/messages`,
      { content },
    );
    return data;
  },

  update: async (
    messageId: string,
    content: string,
  ): Promise<Message> => {
    const { data } = await axiosClient.patch<Message>(
      `/messages/${messageId}`,
      { content },
    );
    return data;
  },

  delete: async (messageId: string): Promise<void> => {
    await axiosClient.delete(`/messages/${messageId}`);
  },

  addReaction: async (
    messageId: string,
    emoji: string,
  ): Promise<{ reactions: MessageReaction[] }> => {
    const { data } = await axiosClient.post<{ reactions: MessageReaction[] }>(
      `/messages/${messageId}/reactions`,
      { emoji },
    );
    return data;
  },

  removeReaction: async (
    messageId: string,
    reactionId: string,
  ): Promise<{ reactions: MessageReaction[] }> => {
    const { data } = await axiosClient.delete<{ reactions: MessageReaction[] }>(
      `/messages/${messageId}/reactions/${reactionId}`,
    );
    return data;
  },

  translate: async (
    messageId: string,
    targetLang?: string,
  ): Promise<{ translatedText: string; lang: string }> => {
    const params = targetLang ? `?targetLang=${targetLang}` : '';
    const { data } = await axiosClient.post<{ translatedText: string; lang: string }>(
      `/messages/${messageId}/translate${params}`,
    );
    return data;
  },
};

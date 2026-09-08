import { axiosClient } from '@/lib/axiosClient';

export interface SemanticResult {
  messageId: string;
  content: string;
  channelId: string;
  channelName: string;
  senderName: string;
  createdAt: string;
  similarity: number;
}

export interface SemanticSearchResponse {
  results: SemanticResult[];
}

export interface AiDocument {
  id: string;
  serverId: string;
  title: string;
  /** Backend index chạy fire-and-forget ngay trong createDocument — luôn 'READY' khi list ra */
  status: 'PROCESSING' | 'READY' | 'FAILED';
  /** Số chunk embedding đã sinh (lấy từ _count.chunks của Prisma) */
  chunkCount: number;
  createdAt: string;
}

export const aiApi = {
  semanticSearch: async (
    query: string,
    serverId: string,
    channelId?: string,
  ): Promise<SemanticResult[]> => {
    const params = new URLSearchParams({ query, serverId });
    if (channelId) params.set('channelId', channelId);
    const { data } = await axiosClient.get<SemanticSearchResponse>(
      `/search/semantic?${params}`,
    );
    return data.results ?? [];
  },

  listDocuments: async (serverId: string): Promise<AiDocument[]> => {
    const { data } = await axiosClient.get<AiDocument[]>(`/servers/${serverId}/ai-documents`);
    return data;
  },

  uploadDocument: async (serverId: string, title: string, content: string): Promise<AiDocument> => {
    const { data } = await axiosClient.post<AiDocument>(`/servers/${serverId}/ai-documents`, { title, content });
    return data;
  },

  deleteDocument: async (serverId: string, documentId: string): Promise<void> => {
    await axiosClient.delete(`/servers/${serverId}/ai-documents/${documentId}`);
  },

  askAi: async (channelId: string, question: string): Promise<{ answer: string }> => {
    const { data } = await axiosClient.post<{ answer: string }>(`/channels/${channelId}/ai/ask`, { question });
    return data;
  },

  catchUp: async (channelId: string, since?: string): Promise<{ summary: string }> => {
    const params = since ? `?since=${since}` : '';
    const { data } = await axiosClient.get<{ summary: string }>(`/channels/${channelId}/catch-up${params}`);
    return data;
  },
};

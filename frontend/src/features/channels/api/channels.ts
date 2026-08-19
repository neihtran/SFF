import { axiosClient } from '@/lib/axiosClient';

export interface Channel {
  id: string;
  serverId: string | null;
  name: string | null;
  type: 'TEXT' | 'VOICE' | 'DM';
  createdAt: string;
}

export const channelsApi = {
  list: async (serverId: string): Promise<Channel[]> => {
    const { data } = await axiosClient.get<Channel[]>(
      `/servers/${serverId}/channels`,
    );
    return data;
  },

  create: async (
    serverId: string,
    name: string,
    type: 'TEXT' | 'VOICE',
  ): Promise<Channel> => {
    const { data } = await axiosClient.post<Channel>(
      `/servers/${serverId}/channels`,
      { name, type },
    );
    return data;
  },

  listDm: async (): Promise<Channel[]> => {
    const { data } = await axiosClient.get<Channel[]>('/dm');
    return data;
  },
};

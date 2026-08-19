import { axiosClient } from '@/lib/axiosClient';

export interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  members: Array<{ role: 'OWNER' | 'MODERATOR' | 'MEMBER'; status: string }>;
  _count?: { members: number };
}

export const serversApi = {
  listMine: async (): Promise<Server[]> => {
    const { data } = await axiosClient.get<Server[]>('/servers/mine');
    return data;
  },

  getOne: async (serverId: string): Promise<Server> => {
    const { data } = await axiosClient.get<Server>(`/servers/${serverId}`);
    return data;
  },

  create: async (name: string): Promise<Server> => {
    const { data } = await axiosClient.post<Server>('/servers', { name });
    return data;
  },

  join: async (inviteCode: string): Promise<void> => {
    await axiosClient.post('/servers/join', { inviteCode });
  },

  leave: async (serverId: string): Promise<void> => {
    await axiosClient.delete(`/servers/${serverId}/leave`);
  },
};

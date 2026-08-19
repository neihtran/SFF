import { axiosClient } from '@/lib/axiosClient';

export interface VoiceTokenResponse {
  token: string;
  livekitUrl: string;
}

export interface VoiceParticipantsResponse {
  participants: string[];
}

export const voiceApi = {
  getToken: async (channelId: string): Promise<VoiceTokenResponse> => {
    const { data } = await axiosClient.post<VoiceTokenResponse>(
      `/channels/${channelId}/voice-token`,
    );
    return data;
  },

  getParticipants: async (channelId: string): Promise<VoiceParticipantsResponse> => {
    const { data } = await axiosClient.get<VoiceParticipantsResponse>(
      `/channels/${channelId}/voice-participants`,
    );
    return data;
  },
};

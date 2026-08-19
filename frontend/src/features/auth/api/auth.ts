import { axiosClient } from '@/lib/axiosClient';
import type { AuthUser } from '@/store/authStore';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await axiosClient.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    return data;
  },

  register: async (
    name: string,
    email: string,
    password: string,
  ): Promise<AuthResponse> => {
    const { data } = await axiosClient.post<AuthResponse>('/auth/register', {
      name,
      email,
      password,
    });
    return data;
  },

  refresh: async (refreshToken: string): Promise<Pick<AuthResponse, 'accessToken' | 'refreshToken'>> => {
    const { data } = await axiosClient.post('/auth/refresh', { refreshToken });
    return data;
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await axiosClient.get<AuthUser>('/auth/me');
    return data;
  },
};

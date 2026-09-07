import { axiosClient } from '@/lib/axiosClient';

export interface UploadResult {
  url: string;
  fileName: string;
  fileType: 'image' | 'file';
  size: number;
}

export const storageApi = {
  /**
   * Upload 1 file (image/file) lên Supabase Storage qua backend.
   * Trả về public URL — client có thể nhúng vào attachmentUrls khi gửi message.
   */
  upload: async (file: File): Promise<UploadResult> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await axiosClient.post<UploadResult>(
      '/storage/message-attachments',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Upload có thể lâu với file lớn → timeout 60s thay vì default 15s
        timeout: 60_000,
      },
    );
    return data;
  },
};

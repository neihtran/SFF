import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Hash, Volume2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { channelsApi, type Channel } from '@/features/channels/api/channels';

const createChannelSchema = z.object({
  name: z.string().min(1, 'Tên channel bắt buộc').max(100),
  type: z.enum(['TEXT', 'VOICE']),
});

type CreateChannelForm = z.infer<typeof createChannelSchema>;

interface CreateChannelDialogProps {
  open: boolean;
  serverId: string;
  onClose: () => void;
  onCreated: (channel: Channel) => void;
}

export function CreateChannelDialog({ open, serverId, onClose, onCreated }: CreateChannelDialogProps): React.ReactElement {
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateChannelForm>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: { name: '', type: 'TEXT' },
  });

  async function onSubmit(values: CreateChannelForm) {
    setLoading(true);
    try {
      const ch = await channelsApi.create(serverId, values.name.trim(), values.type);
      onCreated(ch);
      toast.success(`Channel #${ch.name} đã được tạo`);
      onClose();
      form.reset();
    } catch {
      toast.error('Không thể tạo channel');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tạo channel mới</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên channel</FormLabel>
                  <FormControl>
                    <Input placeholder="general" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại</FormLabel>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => field.onChange('TEXT')}
                      className={`flex flex-1 items-center gap-2 rounded-md border p-3 text-sm transition-colors ${
                        field.value === 'TEXT' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Hash size={16} /> Text
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange('VOICE')}
                      className={`flex flex-1 items-center gap-2 rounded-md border p-3 text-sm transition-colors ${
                        field.value === 'VOICE' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Volume2 size={16} /> Voice
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang tạo…' : 'Tạo channel'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

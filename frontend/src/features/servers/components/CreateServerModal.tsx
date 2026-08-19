import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { serversApi, type Server } from '@/features/servers/api/servers';

const createServerSchema = z.object({ name: z.string().min(2).max(50) });
type CreateServerForm = z.infer<typeof createServerSchema>;

interface CreateServerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (server: Server) => void;
}

export function CreateServerModal({ open, onClose, onCreated }: CreateServerModalProps): React.ReactElement {
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateServerForm>({
    resolver: zodResolver(createServerSchema),
    defaultValues: { name: '' },
  });

  async function onSubmit(values: CreateServerForm) {
    setLoading(true);
    try {
      const srv = await serversApi.create(values.name);
      onCreated(srv);
      toast.success(`Server "${srv.name}" đã được tạo!`);
      onClose();
      form.reset();
    } catch {
      toast.error('Không thể tạo server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo server mới</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên server</FormLabel>
                  <FormControl>
                    <Input placeholder="VD: Cộng đồng học tập" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang tạo…' : 'Tạo server'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

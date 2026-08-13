import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';

export function HomePage(): React.ReactElement {
  return (
    <main className="flex h-full items-center justify-center bg-background p-6">
      <Toaster />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">SFF — Say For Fun</CardTitle>
          <CardDescription>
            Frontend scaffold ready. Backend: NestJS + Prisma + Supabase + Gemini + LiveKit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button variant="default">Đăng nhập</Button>
          <Button variant="outline">Tạo tài khoản</Button>
        </CardContent>
      </Card>
    </main>
  );
}

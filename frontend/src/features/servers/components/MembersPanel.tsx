import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MemberList } from './MemberList';
import type { Server } from '@/features/servers/api/servers';

interface MembersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: Server;
  currentUserId: string;
}

/**
 * Slide-in panel từ bên phải (shadcn Sheet).
 * Hiển thị danh sách thành viên server + quản lý role/kick/ban (nếu có quyền).
 */
export function MembersPanel({ open, onOpenChange, server, currentUserId }: MembersPanelProps): React.ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>Thành viên</SheetTitle>
          <SheetDescription>Quản lý thành viên server {server.name}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <MemberList server={server} currentUserId={currentUserId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Shield, Crown, User as UserIcon, MoreHorizontal } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { axiosClient } from '@/lib/axiosClient';
import type { Server } from '@/features/servers/api/servers';

interface Member {
  id: string;
  userId: string;
  role: 'OWNER' | 'MODERATOR' | 'MEMBER';
  status: 'ACTIVE' | 'BANNED' | 'KICKED';
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  joinedAt: string;
}

interface MemberListProps {
  server: Server;
  currentUserId: string;
}

export function MemberList({ server, currentUserId }: MemberListProps): React.ReactElement {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [kickTarget, setKickTarget] = useState<Member | null>(null);
  const [banTarget, setBanTarget] = useState<Member | null>(null);
  const [action, setAction] = useState<'kick' | 'ban' | null>(null);

  const currentMember = members.find((m) => m.userId === currentUserId);
  const canManage = currentMember?.role === 'OWNER' || currentMember?.role === 'MODERATOR';

  useEffect(() => {
    axiosClient
      .get<Member[]>(`/servers/${server.id}/members`)
      .then((r) => setMembers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [server.id]);

  async function handleRoleChange(member: Member, newRole: 'MODERATOR' | 'MEMBER') {
    try {
      await axiosClient.patch(`/servers/${server.id}/members/${member.userId}/role`, { role: newRole });
      setMembers((prev) =>
        prev.map((m) => (m.userId === member.userId ? { ...m, role: newRole } : m)),
      );
      toast.success(`Đã đổi vai trò ${member.user.name} → ${newRole}`);
    } catch {
      toast.error('Không thể đổi vai trò');
    }
  }

  async function handleKick(member: Member) {
    setKickTarget(member);
    setAction('kick');
  }

  async function handleBan(member: Member) {
    setBanTarget(member);
    setAction('ban');
  }

  async function confirmAction() {
    if (!kickTarget && !banTarget) return;
    const target = kickTarget! ?? banTarget!;
    try {
      if (action === 'kick') {
        await axiosClient.delete(`/servers/${server.id}/members/${target.userId}`);
        setMembers((prev) => prev.filter((m) => m.userId !== target.userId));
        toast.success(`Đã kick ${target.user.name}`);
      } else {
        await axiosClient.post(`/servers/${server.id}/members/${target.userId}/ban`);
        setMembers((prev) =>
          prev.map((m) => (m.userId === target.userId ? { ...m, status: 'BANNED' } : m)),
        );
        toast.success(`Đã ban ${target.user.name}`);
      }
    } catch {
      toast.error(`Không thể ${action} thành viên`);
    } finally {
      setKickTarget(null);
      setBanTarget(null);
      setAction(null);
    }
  }

  const roleOrder = ['OWNER', 'MODERATOR', 'MEMBER'];
  const sorted = [...members].sort((a, b) => {
    return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
  });

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Thành viên — {members.length}
        </h3>
      </div>

      {loading ? (
        [...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
      ) : (
        sorted.map((member) => (
          <MemberRow
            key={member.userId}
            member={member}
            canManage={canManage && member.role !== 'OWNER' && member.userId !== currentUserId}
            onRoleChange={(role) => handleRoleChange(member, role)}
            onKick={() => handleKick(member)}
            onBan={() => handleBan(member)}
          />
        ))
      )}

      <AlertDialog open={!!(kickTarget || banTarget)} onOpenChange={() => { setKickTarget(null); setBanTarget(null); setAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === 'kick' ? 'Kick thành viên?' : 'Ban thành viên?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === 'kick'
                ? `${kickTarget?.user.name} sẽ bị loại khỏi server. Họ có thể tham gia lại bằng mã mời.`
                : `${banTarget?.user.name} sẽ bị cấm vĩnh viễn khỏi server. Không thể hoàn tác.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className={action === 'ban' ? 'bg-destructive text-destructive-foreground' : undefined}
              onClick={confirmAction}
            >
              {action === 'kick' ? 'Kick' : 'Ban vĩnh viễn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MemberRow({
  member,
  canManage,
  onRoleChange,
  onKick,
  onBan,
}: {
  member: Member;
  canManage: boolean;
  onRoleChange: (role: 'MODERATOR' | 'MEMBER') => void;
  onKick: () => void;
  onBan: () => void;
}): React.ReactElement {
  const roleIcon = member.role === 'OWNER' ? <Crown size={12} className="text-yellow-500" /> :
                  member.role === 'MODERATOR' ? <Shield size={12} className="text-primary" /> :
                  <UserIcon size={12} className="text-muted-foreground" />;

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
      <Avatar className="size-8">
        <AvatarFallback className="text-xs">{member.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{member.user.name}</span>
          {roleIcon}
        </div>
        {member.status !== 'ACTIVE' && (
          <Badge variant="destructive" className="mt-0.5 text-[10px]">{member.status}</Badge>
        )}
      </div>

      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {member.role === 'MEMBER' && (
              <DropdownMenuItem onClick={() => onRoleChange('MODERATOR')}>
                <Shield size={14} className="mr-2" /> Đặt làm Moderator
              </DropdownMenuItem>
            )}
            {member.role === 'MODERATOR' && (
              <DropdownMenuItem onClick={() => onRoleChange('MEMBER')}>
                <UserIcon size={14} className="mr-2" /> Hạ xuống Member
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onKick} className="text-warning">
              🚪 Kick khỏi server
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBan} className="text-destructive">
              🔨 Ban vĩnh viễn
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

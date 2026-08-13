// Mức quyền theo thứ tự: OWNER > MODERATOR > MEMBER
// Dùng chung cho mọi module liên quan đến server.
// NGUYÊN TẮC: mức role của người thực hiện PHẢI >= mức tối thiểu của action.
export enum ServerRoleLevel {
  MEMBER = 1,
  MODERATOR = 2,
  OWNER = 3,
}

export const ROLE_DISPLAY: Record<string, string> = {
  OWNER: 'Chủ sở hữu',
  MODERATOR: 'Quản trị viên',
  MEMBER: 'Thành viên',
};

export function isRoleAtLeast(userRole: string, requiredRole: string): boolean {
  return (
    ServerRoleLevel[userRole as keyof typeof ServerRoleLevel] >=
    ServerRoleLevel[requiredRole as keyof typeof ServerRoleLevel]
  );
}

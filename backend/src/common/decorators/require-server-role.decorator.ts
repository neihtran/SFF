import { SetMetadata } from '@nestjs/common';
import { ServerRole } from '@prisma/client';

export const REQUIRED_ROLE_KEY = 'requiredServerRole';

/**
 * Decorator đánh dấu endpoint cần role tối thiểu trong server.
 * Ví dụ: @RequireServerRole('MODERATOR') → cho phép OWNER hoặc MODERATOR.
 *
 * Thứ tự ưu tiên: OWNER > MODERATOR > MEMBER
 *
 * Lưu ý: ServerRoleGuard cần PrismaService → guard đặt trong guards/
 * thay vì decorators/ (decorators chỉ set metadata, không inject được service).
 */
export const RequireServerRole = (role: ServerRole) =>
  SetMetadata(REQUIRED_ROLE_KEY, role);

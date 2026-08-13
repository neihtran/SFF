import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  preferredLang: string;
}

export const CurrentUser = createParamDecorator(
  (_data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return _data ? user?.[_data] : user;
  },
);

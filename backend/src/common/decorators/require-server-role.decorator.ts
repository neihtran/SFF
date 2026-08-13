import { SetMetadata } from '@nestjs/common';

export type MinRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

export const MIN_ROLE_KEY = 'minRole';
export const REQUIRE_MEMBERSHIP_KEY = 'requireMembership';

export function RequireServerRole(
  role: MinRole,
  requireMembership = true,
): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    SetMetadata(MIN_ROLE_KEY, role)(target, propertyKey, descriptor);
    SetMetadata(REQUIRE_MEMBERSHIP_KEY, requireMembership)(
      target,
      propertyKey,
      descriptor,
    );
    return descriptor;
  };
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Usage:
 *   @GetUser() user => whole user object
 *   @GetUser('id') userId => user.id
 */
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    return data ? user?.[data] : user;
  },
);

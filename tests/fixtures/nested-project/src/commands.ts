import { IsString, IsNotEmpty } from 'class-validator';

/**
 * @publish
 * Tests that decorators are stripped and constructors are not emitted.
 */
export class SyncPlayerCommandPayload {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

/**
 * @publish
 * Tests that constructor parameter properties are promoted to class properties
 * and no constructor is emitted in the output.
 */
export class SyncPlayerCommand {
  readonly type = 'SYNC_PLAYER';

  constructor(public readonly payload: SyncPlayerCommandPayload) {}
}

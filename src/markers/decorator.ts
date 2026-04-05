/**
 * Class decorator that marks a class as publishable by typeship.
 *
 * @example
 * ```ts
 * import { Publish } from '@arompr/typeship';
 *
 * @Publish()
 * export class UserDto {
 *   id: string;
 *   email: string;
 * }
 * ```
 *
 * Compatible with both `experimentalDecorators` and TypeScript 5 TC39 decorators.
 */
export function Publish() {
  return (target: any): void => {
    Reflect.defineProperty(target, '__typeship_publish__', {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  };
}

/** Returns true if a class constructor was decorated with @Publish(). */
export function isPublished(target: Function): boolean {
  return Reflect.has(target, '__typeship_publish__');
}

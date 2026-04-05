import { describe, it, expect } from 'vitest';
import { Publish, isPublished } from '../../src/markers/decorator';

describe('@Publish() decorator', () => {
  it('marks a class as published', () => {
    @Publish()
    class UserDto {
      id!: string;
    }

    expect(isPublished(UserDto)).toBe(true);
  });

  it('returns false for undecorated class', () => {
    class UnmarkedDto {
      id!: string;
    }

    expect(isPublished(UnmarkedDto)).toBe(false);
  });

  it('does not affect two different classes independently', () => {
    @Publish()
    class PublishedA {}

    class NotPublishedB {}

    expect(isPublished(PublishedA)).toBe(true);
    expect(isPublished(NotPublishedB)).toBe(false);
  });
});

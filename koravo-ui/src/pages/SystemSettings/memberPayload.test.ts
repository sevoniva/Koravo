import { describe, expect, it } from 'vitest';
import {
  organizationMemberCreatePayload,
  organizationMemberProfilePayload,
} from './memberPayload';

describe('organization member payloads', () => {
  it('keeps password out of profile updates', () => {
    expect(
      organizationMemberProfilePayload({
        userId: 'manager.li',
        name: '李经理',
        department: '业务一部',
        role: 'manager',
        status: 'ACTIVE',
        password: 'Koravo@2026',
      }),
    ).toEqual({
      userId: 'manager.li',
      name: '李经理',
      department: '业务一部',
      role: 'manager',
      status: 'ACTIVE',
    });
  });

  it('keeps initial password in create payloads', () => {
    expect(
      organizationMemberCreatePayload({
        userId: 'applicant.chen',
        name: '陈发起',
        department: '运营中心',
        role: 'applicant',
        status: 'ACTIVE',
        password: 'Koravo@2026',
      }),
    ).toEqual({
      userId: 'applicant.chen',
      name: '陈发起',
      department: '运营中心',
      role: 'applicant',
      status: 'ACTIVE',
      password: 'Koravo@2026',
    });
  });
});

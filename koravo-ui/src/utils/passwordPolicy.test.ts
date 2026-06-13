import { describe, expect, it } from 'vitest';
import {
  PASSWORD_POLICY_MESSAGE,
  isPasswordPolicySatisfied,
  passwordPolicyRules,
} from './passwordPolicy';

describe('password policy', () => {
  it('matches the backend organization password policy', () => {
    expect(isPasswordPolicySatisfied('Koravo@2026')).toBe(true);
    expect(isPasswordPolicySatisfied('password')).toBe(false);
    expect(isPasswordPolicySatisfied('Password2026')).toBe(false);
    expect(passwordPolicyRules.map((rule) => rule.message)).toEqual([
      PASSWORD_POLICY_MESSAGE,
      PASSWORD_POLICY_MESSAGE,
    ]);
  });
});

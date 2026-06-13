export const PASSWORD_POLICY_MESSAGE =
  '密码至少 10 位，且包含大小写字母、数字和特殊字符';

export const PASSWORD_POLICY_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export const passwordPolicyRules = [
  { min: 10, message: PASSWORD_POLICY_MESSAGE },
  {
    pattern: PASSWORD_POLICY_PATTERN,
    message: PASSWORD_POLICY_MESSAGE,
  },
];

export function isPasswordPolicySatisfied(password: string) {
  return password.length >= 10 && PASSWORD_POLICY_PATTERN.test(password);
}

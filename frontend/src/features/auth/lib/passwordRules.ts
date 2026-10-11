export interface PasswordRule {
  label: string;
  ok: boolean;
}

export function passwordRules(password: string, repeat: string, username: string): PasswordRule[] {
  const lowered = password.toLowerCase();
  return [
    { label: 'Co najmniej 8 znaków', ok: password.length >= 8 },
    { label: 'Nie same cyfry', ok: password.length > 0 && !/^\d+$/.test(password) },
    {
      label: 'Inne niż login',
      ok: password.length > 0 && (!username || !lowered.includes(username.toLowerCase())),
    },
    { label: 'Oba pola zgodne', ok: password.length > 0 && password === repeat },
  ];
}

export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(password) && /[a-ząćęłńóśźż]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^\p{L}\d]/u.test(password)) score += 1;
  return Math.max(1, score);
}
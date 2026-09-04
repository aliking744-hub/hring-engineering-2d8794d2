import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('account security exposes authenticated phone enrollment and strict OTP input', async () => {
  const source = await read('src/pages/AccountSecurity.tsx');

  assert.match(source, /apiRequest<SmsChallenge>\('\/auth\/phone\/request-verification'/);
  assert.match(source, /apiRequest<void>\('\/auth\/phone\/verify'/);
  assert.match(source, /replace\(\/\\D\/g, ''\)\.slice\(0, 6\)/);
  assert.match(source, /autoComplete="one-time-code"/);
  assert.match(source, /phoneCode\.length !== 6/);
  assert.doesNotMatch(source, /replace\(\/\\\\D\/g/);
});

test('public SMS login remains wired to the independent auth API', async () => {
  const auth = await read('src/hooks/useAuth.tsx');
  const page = await read('src/pages/Auth.tsx');

  assert.match(auth, /'\/auth\/sms\/request'/);
  assert.match(auth, /'\/auth\/sms\/verify'/);
  assert.match(page, /requestSmsLogin\(phone\.trim\(\)\)/);
  assert.match(page, /verifySmsLogin\(smsChallengeId, smsCode\.trim\(\)\)/);
});

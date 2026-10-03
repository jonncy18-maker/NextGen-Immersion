# Neon Auth — setting a password via SQL

Moved from the agent instructions (`AGENTS.md` → *Key Rules* points here). Scholar accounts are admin-provisioned; use this when a password must be set or reset directly in `neon_auth.account`.

**Neon Auth password format:** Passwords in `neon_auth.account` use `@better-auth/utils` scrypt — format is `<hex_salt>:<hex_hash>` (161 chars total: 32-char hex salt + `:` + 128-char hex hash). Parameters: N=16384, r=16, p=1, dkLen=64. Critically, the salt is passed to `node:crypto scrypt` as a **hex string** (not a Buffer), and the password is **NFKC-normalized** before hashing. To set a password via SQL, generate the hash with this exact script:
```js
const { randomBytes, scrypt } = require('node:crypto')
const salt = randomBytes(16).toString('hex') // hex string, not Buffer
scrypt(password.normalize('NFKC'), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128*16384*16*2 }, (err, key) => {
  console.log(`${salt}:${key.toString('hex')}`) // paste this into the UPDATE
})
```
Then: `UPDATE neon_auth.account SET password = '<output>', "updatedAt" = now() WHERE "userId" = '<id>' AND "providerId" = 'credential'`

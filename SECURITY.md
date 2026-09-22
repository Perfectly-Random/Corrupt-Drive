# Security and data handling

## Accounts

Usernames contain 3–24 ASCII letters, digits, underscores, or hyphens and are normalised to lowercase. Passwords must be 10–72 bytes. PostgreSQL pgcrypto hashes passwords with a per-password salt and bcrypt cost 12; plaintext passwords are never written to account tables or application logs.

Account creation produces a 24-byte random recovery code, returned once. Only its SHA-256 hash is stored. Recovery rotates the code and password and revokes old sessions. There is no email recovery service. Do not ask students to use their real names or personal email addresses.

## Sessions and request boundaries

A login creates a 32-byte random session token. Only its SHA-256 hash is stored in PostgreSQL. The gateway places it in a production `__Host-cd_session` cookie with Secure, HttpOnly, SameSite=Strict, Path=/ and a 30-day lifetime. The user token is removed from the JSON response. Logout revokes it server-side.

Mutating application requests require JSON and a matching Origin. Cross-site browser requests are rejected. The gateway selects the session from its cookie, never from a caller-supplied user ID or token. A Content Security Policy restricts scripts and connections to the same origin; external fonts/scripts are not used.

Database rate limits cover account requests, username attempts, registration, and per-user save operations. They reduce abuse but are not a substitute for a production anti-bot service or provider-level resource quotas.

## Public gateway credential

`lib/public-gateway.js` deliberately contains a publishable anonymous-equivalent JWT. It is NOT a database-owner key, a signing private key, or a user's session. Its only database role is `cd_gateway`, which can execute a restricted account RPC but cannot select account, session, or save tables. Each sensitive RPC action independently checks a password/recovery code or a random per-user session. The signing private key was not retained or committed. `public/jwks.json` holds only the verification key.

The public credential is intended to be observable. Never add private-table privileges, arbitrary SQL execution, or an administrative action to this role/RPC. Expiry requires future gateway credential rotation. The deployed Data API trusts this application's public verification endpoint; moving the domain or replacing its key requires coordinated backend configuration.

## Database isolation

The Corrupt Drive schema lives in a dedicated database on a separate Neon branch. `game_private` has no PUBLIC or gateway table access. `game_api.rpc` is a fixed SECURITY DEFINER function with `search_path=pg_catalog` and fully qualified object names. No arbitrary SQL or dynamic table identifiers come from the browser.

The isolated branch shares its parent project's infrastructure/billing limits, not live mutations of the other applications. The initial branch inherits other databases; this application does not expose or use them.

## Save safety and limits

Saves are per authenticated user, limited to 500 KB, and require a known schema version and expected revision. Updates use a single atomic compare-and-swap query. A stale revision returns 409. The client retains an account-scoped local backup and never labels pending/failed writes as cloud-saved.

This is not an anti-cheat service. Browser-generated game state can be edited by its owner. No competitive or graded assessment integrity is claimed. There is no automated data-erasure UI or class-account administration yet; arrange operator-assisted deletion under an explicit authorised request. Export is available in the game.

Do not post passwords, recovery codes, session cookies, personal student data, or database connection strings in public GitHub issues. Security findings should be shared privately with the repository owner. Review settings, backups, retention, and school requirements before broad deployment.

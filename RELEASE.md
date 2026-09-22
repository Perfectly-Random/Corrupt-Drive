# Version 2.0 verification

## Executed checks

- 50,113 generator/world assertions: six skill families, three difficulty levels, both unit conventions, 18,000 generated questions, 300 seeded maps, connected encounters, tutorial progression, inventory limits, banking, crash retention, core transitions, and serialized run validation.
- 14 Node gateway test cases: HTTP methods, same-origin checks, content type, body limits, malformed input, action whitelist, secure cookies, cookie-owned sessions, conflict propagation, logout, and malformed upstream responses.
- Real PostgreSQL self-test: registration, wrong-password rejection, save/load, cross-account isolation, forged-token rejection, revision conflicts, invalid save rejection, recovery, session revocation, logout, table privacy, and RPC privileges. Test records were rolled back rather than retained.
- Chromium offline DOM integration: account forms, recovery-code handling, all tutorial stages, wrong-answer feedback, tutorial isolation, new run, repair, conflict/reload UI, banking, archive, sign-out/sign-in using a simulated server, and 390-pixel mobile overflow checks. No page script errors were observed.
- Live Vercel-to-Neon health check returned success before release publication. Final deployment/status checks are performed separately after the release commit.

## Boundaries

The Chromium network environment forbids remote navigation. Browser tests therefore use local source and a simulated transport. They are not an end-to-end claim about a real user's live browser, cookies, or a second physical device. The real database functions and hosted gateway were verified independently.

First manual acceptance: create a nickname account, privately save its recovery code, finish the tutorial, bank a real fragment, wait for CLOUD SAVED, then sign in from a second browser and confirm the archive and run state. Do not run the same expedition concurrently on two devices; the second save should prompt conflict resolution.

This is a playable, deployed prototype release. Balance, content production, classroom administration, and independent security review remain separate work. The current release is not a multiplayer game or secure exam-marking system.

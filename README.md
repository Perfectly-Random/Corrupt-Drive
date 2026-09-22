# Corrupt Drive — Recovery OS 2.0

A single-player, account-based educational recovery roguelite. Explore a damaged filesystem, practise data representation, recover fragments, and gradually restore a machine and its authored mystery.

Production: https://corrupt-drive.vercel.app
Repository: https://github.com/Perfectly-Random/Corrupt-Drive

## Play

Create a nickname-based account, choose a password, and save the one-time recovery code privately. No email address is required. The interactive tutorial begins on a new account and is replayable through Guide. It uses an isolated training state and does not overwrite an active expedition or inflate practice statistics.

Move with WASD, arrow keys, touch arrows, or by clicking a revealed map tile. E interacts, Q scans, R patches integrity, and T opens the computing reference. Corruption advances only with actions, never while reading. Bank cargo at an uplink or extract; a crash loses unbanked cargo, not previously recovered files or practice records.

Wait for CLOUD SAVED before switching devices. A newer revision on another device produces a conflict notice rather than silently overwriting it. Export the local backup before loading the newer cloud save when both contain changes.

## Included

- Three layers across six spatial directories, seeded obstacles/encounters, fog, optional ASCII traces, and a discoverable maintenance relay.
- Five mission types, three anchors per core, ten module types, helpful indexers, watchdogs, and cleanup processes.
- Limited recovery buffer, temporary builds, cargo banking, extraction, and permanent subsystem restoration.
- 24 authored artifacts with 96 distinct fragments; illustrative SVG recovery previews and synthesised audio with accessible narrative text.
- Storage units, binary/denary, hexadecimal, ASCII, uncompressed image sizes, and uncompressed audio sizes. Worked feedback, free references, topic selection, adaptive difficulty, and CSV diagnostics.
- Required accounts, server-side progress, secure session cookies, recovery codes, local unsent-change backups, and revision conflict detection.

## Architecture

The application has no npm runtime dependencies. Vercel serves `public/` and runs `api/account.js`. The account gateway calls a restricted PostgreSQL RPC through Neon Data API. An isolated branch and a dedicated `corrupt_drive` database keep this application separate from the other applications in the account. No other application's tables or authentication configuration are changed.

`engine.js` generates questions; `world.js` is the deterministic simulation; `archive.js` is authored fiction. Four classic deferred scripts (`client.js`, `drive-view.js`, `library-view.js`, `controls.js`) coordinate rendering, gameplay, and cloud saves. Script order in `index.html` matters.

The database migration is in `db/001_accounts.sql`. Public access is restricted to the account RPC, not private tables. See SECURITY.md before changing authentication or cloning this application.

## Development and tests

Use Node.js 22 or newer. No npm install is needed.

```sh
npm test
npm run dev
```

The local server opens at `http://127.0.0.1:8091`. Its account endpoint uses the configured live backend; use an explicitly designated test account for manual development. The automated API tests mock upstream requests and do not create live accounts.

Browser integration tests require Python, Playwright, and a Chromium executable:

```sh
python -m pip install playwright
CHROMIUM_PATH=/usr/bin/chromium python tests/browser-test.py
```

These browser tests load the local DOM and script files with a simulated network transport. They do not navigate or modify the production site. `tests/browser-report.json` records their scope. The release was also checked against the real PostgreSQL account functions and live Vercel-to-database health endpoint; these are distinct test layers, not a claim that a complete remote-browser journey was tested.

## Deployment

Push to `main` in this repository. The connected `corrupt-drive` Vercel project deploys automatically. Framework is Other, output directory is `public`, and build/install commands are blank. Server functions live outside `public`. `vercel.json` sets security headers and a same-origin script policy.

For a new independent installation, provision a separate database and gateway configuration. Do not reuse the deployment-specific backend endpoint or its public gateway credential in a different game. There are no privileged database credentials in this repository.

## Educational and prototype boundaries

Questions distinguish decimal prefixes (kB/MB, steps of 1000) from binary prefixes (KiB/MiB, steps of 1024). Standard ASCII is 7-bit; character-storage questions explicitly use 8-bit bytes. Encoding is not encryption. Teachers should select the convention and topics appropriate to their course.

The inventory's reserved file sizes, fixed packing reduction, and running processes inside the drive are gameplay abstractions. The image previews are prototype illustrations; audio is synthesised, not recorded speech. The authored archive is not 100 separate completed story files.

This release is single-player: no multiplayer, teacher dashboard, class administration, email reset, or anti-cheat grading. Game scores are client-authoritative and are not suitable as secure assessment marks. Before wider student use, review your school's account/data requirements and perform a small classroom pilot. Use nicknames and sign out on shared devices.

# Play Store Distribution — TWA + Internal Testing

**Status: PLANNED (not yet built).** Runbook for packaging the PWA as an
Android app and distributing it to scholars via Google Play's **Internal
Testing** track. Nothing here is done yet. Prerequisite: `docs/PWA.md` must be
complete and passing its checklist first — a TWA is only as good as the PWA it
wraps.

**Immersion is the pilot** for the whole NGS native rollout. Get this working
end-to-end here, then copy this runbook into NextGen-Scholars. AI-Capital is a
separate, possibly-public decision (see that repo's ROADMAP) and is not covered
here.

---

## The model (what a TWA actually is)

A **Trusted Web Activity (TWA)** is a minimal native Android app whose only job
is to open your PWA full-screen in a Chrome Custom Tab, with the browser UI
(URL bar) removed. "Trusted" = you prove you own both the website and the app
via **Digital Asset Links**, which is what removes the URL bar. The web content
still lives on Vercel and updates when you deploy — you only rebuild/resubmit
the Android app when the *native shell* changes (icon, name, target SDK), not
for content/UI changes.

- Web code updates → just `git push` → Vercel deploys → installed app shows it.
- Native shell updates (rare) → rebuild APK/AAB → upload new version to Play.

---

## Distribution choice: Internal Testing track (decided)

We use the **Internal Testing** track, not a public production listing.
Rationale (recorded): the app is a private internal scholarship tool for a
handful of named scholars, not a public product.

What Internal Testing gives us:
- Up to **100 testers** by email allowlist; install via a Play Store opt-in
  link (real Play install experience for scholars).
- **No 14-day / 12-tester closed-testing gate** that new personal developer
  accounts must clear before *production* release — Internal Testing is exempt.
- **No public-listing review scrutiny** ("minimum functionality" etc.), no
  store search presence, minimal store-listing requirements.

Trade-off: scholars must be added to the tester allowlist by the Google account
they use on their device, and they install via the opt-in link (not by
searching the Play Store). That is exactly what we want for a private tool.

> **Scholar prerequisite — confirm before rollout:** each scholar needs a
> Google account, and the account signed into Play on their device must be one
> added to the tester list. This is the most common "I can't install it" snag.
> Collect scholars' Gmail addresses up front.

---

## One-time setup

1. **Google Play Developer account** — $25 one-time fee, tied to your Google
   identity. Owned by John (not something Claude Code can create). Required
   before anything can be uploaded.
2. **App signing** — enroll in **Play App Signing** (Google manages the app
   signing key; you hold an upload key). You'll need the **SHA-256 fingerprint
   of the app signing key** from the Play Console for the asset-links file
   (step below). Note: it's the *app signing* key's fingerprint, not the upload
   key's — a very common mistake that leaves the URL bar showing.

---

## Build the TWA

Two tool options; either is fine:

- **PWABuilder** (web UI, easiest) — enter the deployed PWA URL, it validates
  the manifest and generates a signed Android package (AAB) + the
  `assetlinks.json` snippet. Good for the first pass.
- **Bubblewrap** (CLI, more control) —
  `npm i -g @bubblewrap/cli && bubblewrap init --manifest https://<app-url>/manifest.webmanifest`,
  then `bubblewrap build`. Regenerate with `bubblewrap update` when the shell
  changes.

Key inputs both need:
- **Host/origin** = the production Vercel domain the PWA is served from.
- **App name / package id** — pick a stable reverse-DNS id, e.g.
  `com.nextgenscholars.immersion`. **This id can never change** once published;
  choose deliberately.
- **Launcher icon** = the 512 maskable icon from `docs/PWA.md`.
- **Theme/splash colors** = navy `#162040` (match the manifest).

Output: a signed **`.aab`** (Android App Bundle) to upload to Play, plus the
asset-links fingerprint.

---

## Digital Asset Links (removes the URL bar — get this exact)

The installed app will show an ugly browser URL bar until the site proves it
trusts the app. Serve this at **`https://<app-domain>/.well-known/assetlinks.json`**:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.nextgenscholars.immersion",
    "sha256_cert_fingerprints": ["<SHA-256 OF THE PLAY APP-SIGNING KEY>"]
  }
}]
```

- Put the file in `public/.well-known/assetlinks.json` so Vercel serves it at
  the right path (Next serves `public/` at the root; confirm the
  `next.config.js` SPA rewrite does **not** swallow `/.well-known/*` — add an
  exclusion if needed).
- The fingerprint MUST be the **Play App Signing** key's SHA-256 (from Play
  Console → your app → Setup → App signing), NOT Bubblewrap's local upload key.
  If you sideload a locally-signed APK to test, that build's fingerprint differs
  — so the URL bar may show on sideload but not on the Play-installed version,
  and vice versa. Add **both** fingerprints to the array during testing.
- Verify with Google's Statement List Tester or just install from Play and
  confirm no URL bar.

---

## Upload + Internal Testing rollout

1. Play Console → Create app → fill the minimal app details (name, default
   language, "app" not "game", "free").
2. **Testing → Internal testing → Create new release** → upload the `.aab`.
3. Add release notes, Save, Review, **Roll out to Internal testing**.
4. **Testers tab** → create an email list → add scholars' Gmail addresses →
   Save.
5. Copy the **opt-in URL** → send it to each scholar. They open it on their
   Android device (signed in with the allowlisted Google account), tap "Become
   a tester", then install from the Play listing that appears.
6. Complete the **Data safety** form and content rating even for internal
   testing (Play requires a minimal version). Declare the auth/session data the
   app collects honestly — see the auth/data notes in `CLAUDE.md`.

---

## The three things most likely to bite (verify early)

1. **Auth inside the TWA.** TWAs run in Chrome Custom Tabs and share Chrome's
   cookie jar, so the first-party Neon Auth session cookie (Phase 14) *should*
   persist — but **test this first**, before investing in store setup. If
   sessions don't survive inside the installed app, the app is unusable. This
   is the #1 risk; it's why we pilot with Immersion (which already solved the
   first-party-cookie problem). Verify: install from Internal Testing, sign in,
   kill the app, reopen — still signed in.
2. **Asset-links fingerprint mismatch** → URL bar shows. Covered above; the
   fix is almost always "used the upload key's fingerprint instead of the app
   signing key's."
3. **`/.well-known/assetlinks.json` swallowed by the SPA rewrite** → Google
   can't verify → URL bar shows. Confirm the file returns JSON (not the SPA
   shell HTML) via `curl https://<domain>/.well-known/assetlinks.json`.

---

## Target SDK / maintenance treadmill

Even on Internal Testing, Google periodically raises the **minimum
`targetSdkVersion`** (roughly yearly). When that deadline passes, you must
rebuild the TWA against the newer target SDK and re-upload, or the app can't
receive updates. Bubblewrap/PWABuilder handle the actual target — just budget a
~1-hour rebuild-and-reupload once a year. Note the current target SDK and
deadline here when you first ship.

---

## What Claude Code can and can't do here

- **Can (code side):** everything in `docs/PWA.md`; the
  `public/.well-known/assetlinks.json` file; `next.config.js` exclusions; a
  Bubblewrap config committed to the repo if we want the TWA project versioned.
- **Cannot (yours to own):** the Play Console account, app signing enrollment,
  uploading the `.aab`, managing the tester allowlist, and installing on a real
  device to test. These need your Google identity and a physical Android device.

---

## Rollout order (the plan)

1. `docs/PWA.md` groundwork → passes its checklist. ← do first
2. Build TWA, wire asset links, **verify auth-in-TWA on a real device early**.
3. Internal Testing release → add scholars → send opt-in link.
4. Once proven here, replicate for NextGen-Scholars.
5. AI-Capital decided separately (may go public → different, heavier path).

---

## Future (deferred, not now)

- **Push notifications** (pace nudges: "you're behind this week"). Needs web
  push + permission UX + a sender backend. High value for Immersion
  specifically, but a separate effort after install works.
- **Public production listing** — only if the app ever stops being private.
  Would trigger the 12-tester/14-day gate, full store listing, and content
  review. Not planned for Immersion.

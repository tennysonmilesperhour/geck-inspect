# Geck Inspect: full Aikido queue review

Reviewed September 8, 2026, against main commit fbbe450 and the remediation changes accompanying this report.

## Scope and result

Reviewed all 30 open grouped issues, not just the linked jspdf issue. Also reviewed the ignored queue through its severity filters. Each filtered list was followed to its end. The inventory below records 49 distinct group IDs: 30 open and 19 ignored-only. Aikido's "All findings" counter displayed 48 during the review, so that counter is not treated as a reconciled inventory total. Grouped issues can contain several subissues.

Of the 30 open groups, 24 received code or dependency fixes. Six have documented non-actionable findings in the current code. The ignored-only inventory contains 14 dependency groups now patched and five findings whose current context does not expose the reported vulnerability.

"Fixed in code" is not "resolved in Aikido": scanner confirmation is pending a scan of the new commit. No Aikido ignore, resolve, or risk-acceptance statuses were changed. Historical-secret findings require manual classification even when the flagged value is intentionally public.

## Open groups

| Aikido ID | Finding | Review outcome and evidence |
| --- | --- | --- |
| [27302350](https://app.aikido.dev/issues/27302350/detail) | jspdf | Fixed in code. Upgraded 2.5.2 to 4.2.1, including current patched DOMPurify and fflate. PDF creation smoke test passed. |
| [29227113](https://app.aikido.dev/issues/29227113/detail) | protobufjs | Fixed in code. Removed vulnerable transitive chain through the PostHog upgrade. |
| [42994330](https://app.aikido.dev/issues/42994330/detail) | Secret in submit-indexnow.mjs | Public IndexNow verification token, not a private credential. Historical source and masked suffix match the intentionally public verification file. Keep working indexing setup. |
| [27302367](https://app.aikido.dev/issues/27302367/detail) | Secret in supabaseClient.js | Historical JWT decoded locally to role `anon`, matching the alert suffix. It is a public client key, not service_role. Retained; data protection depends on RLS. This is not a fresh production RLS audit. |
| [27302366](https://app.aikido.dev/issues/27302366/detail) | Secret in robots.txt | Public IndexNow token. Publication is required for ownership verification; no secret rotation warranted. |
| [29656620](https://app.aikido.dev/issues/29656620/detail) | ws | Fixed in code. Resolved version 8.21.3, including Supabase/vendor chains. |
| [27302354](https://app.aikido.dev/issues/27302354/detail) | DOM XSS through window.open | Fixed in code. Affiliate and analytics destinations accept only credential-free HTTPS URLs. Unsafe schemes cannot reach window.open or analytics iframe src. Related fixed-prefix routes and constructed Google Calendar URLs do not expose the same scheme injection. |
| [30493787](https://app.aikido.dev/issues/30493787/detail) | Android SSL configuration | Fixed in code. Explicit system trust store and no-cleartext network security configuration. |
| [27682548](https://app.aikido.dev/issues/27682548/detail) | Unpinned GitHub Actions | Fixed in code. Every third-party action reference in all nine workflows is pinned to a verified full commit SHA. |
| [27302353](https://app.aikido.dev/issues/27302353/detail) | Upload path traversal | Fixed in code. Image keys use a validated user UUID, validated folder, random UUID filename, and MIME-derived extension. User filenames cannot become object path fragments. |
| [37194788](https://app.aikido.dev/issues/37194788/detail) | react-router-dom | Fixed in code. Upgraded to 7.18.3; production build and client-side nested navigation passed. |
| [27369751](https://app.aikido.dev/issues/27369751/detail) | Broad workflow permissions | Fixed in code. Default contents:read; write permissions limited to jobs that publish, commit, or manage issues/PRs. Push credentials scoped to the steps requiring them. |
| [27302348](https://app.aikido.dev/issues/27302348/detail) | DOMPurify | Fixed in code. Resolved 3.4.15; old vulnerable 2.x chain removed. |
| [38998791](https://app.aikido.dev/issues/38998791/detail) | @remix-run/router | Fixed in code. Removed via React Router upgrade. |
| [31222172](https://app.aikido.dev/issues/31222172/detail) | react-router | Fixed in code. Resolved 7.18.3. |
| [30493788](https://app.aikido.dev/issues/30493788/detail) | Exported Android component | Required exported launcher MainActivity. FileProvider is not exported. Native auth handler checks exact callback scheme, host and path, then exchanges the authorization code using PKCE. Disabling the launcher would break app launch/sign-in. |
| [30493786](https://app.aikido.dev/issues/30493786/detail) | Android backup enabled | Fixed in code. Disabled backup and explicitly excluded app data from Android 12+ cloud backup and device transfer. |
| [31464541](https://app.aikido.dev/issues/31464541/detail) | @ungap/structured-clone | Fixed in code. Resolved 1.4.0, including the Aikido-only advisory. |
| [35290550](https://app.aikido.dev/issues/35290550/detail) | react-hook-form | Fixed in code. Upgraded to 7.87.0. |
| [32533665](https://app.aikido.dev/issues/32533665/detail) | @opentelemetry/core | Fixed in code. Vulnerable implementation chain removed with PostHog upgrade; unrelated API interface package remains. |
| [29227112](https://app.aikido.dev/issues/29227112/detail) | @protobufjs/utf8 | Fixed in code. Vulnerable chain removed. |
| [27302356](https://app.aikido.dev/issues/27302356/detail) | lodash | Fixed in code. Resolved 4.18.1. |
| [27369753](https://app.aikido.dev/issues/27369753/detail) | File inclusion in SEO audit | Fixed in code. HTML walker uses lstat, skips symlinks and reads only regular HTML files. It no longer follows repository-controlled symlinks outside the build directory. |
| [33399685](https://app.aikido.dev/issues/33399685/detail) | posthog-js | Fixed in code. Upgraded to 1.428.6, also removing vulnerable telemetry dependencies. |
| [30493789](https://app.aikido.dev/issues/30493789/detail) | FileProvider lacks permission | Current provider is private (`exported=false`) with temporary per-URI grants, matching Android's documented FileProvider pattern. Adding MANAGE_DOCUMENTS is not appropriate for this provider. |
| [43642535](https://app.aikido.dev/issues/43642535/detail) | zod | Fixed in code. Direct and vendor v4 dependency resolve to 4.5.4. Resolver upgraded to 5.9.1. No app imports rely on the old direct Zod v3 API. |
| [34355697](https://app.aikido.dev/issues/34355697/detail) | Persisted checkout credentials | Fixed in code. All ten checkouts use persist-credentials:false. Necessary pushes use a temporary environment-based GitHub credential helper. |
| [44717848](https://app.aikido.dev/issues/44717848/detail) | iOS background snapshot exposure | Fixed in code. Opaque privacy cover is installed before inactivity and removed when active. Native runtime behavior still needs device/simulator verification. |
| [44286691](https://app.aikido.dev/issues/44286691/detail) | Python image-fetch SSRF | Fixed in code. HTTPS only, no credentials or nonstandard ports, no private/mixed DNS results, IP-pinned connection with original TLS hostname verification, no redirects or proxies, size cap and timeouts. Unit tests and real public HTTPS download passed. |
| [27302368](https://app.aikido.dev/issues/27302368/detail) | JavaScript SSRF | Not exploitable as reported. Service worker requests are browser-side GETs behind a same-origin guard. Archived QR code function uses a fixed qrserver.com destination. Meta OAuth calls use fixed graph.facebook.com endpoints, with encoded token parameters. |

## Ignored-only groups

Ignored status was not treated as proof of safety. The dependency findings below were patched alongside the open findings where compatible fixes were available.

| Aikido ID | Finding | Review outcome |
| --- | --- | --- |
| [27302369](https://app.aikido.dev/issues/27302369/detail?status=ignored) | Home.jsx HTML injection | Static, hardcoded feature/comparison content feeds the HTML sinks. No attacker-controlled source found in these sinks. |
| [27302365](https://app.aikido.dev/issues/27302365/detail?status=ignored) | Historic README secret | Historical source is CLAUDE_MODEL=claude-opus-4-7, a model identifier, not a credential. |
| [44286667](https://app.aikido.dev/issues/44286667/detail?status=ignored) | fflate infinite loop | Fixed in code. Alert recommends 0.4.8 to 0.4.9; resolved branches are 0.4.9, 0.7.5 and 0.8.3. The 0.7.5 backport includes the ZIP64 bounds guard. |
| [40563803](https://app.aikido.dev/issues/40563803/detail?status=ignored) | postcss | Fixed in code, 8.5.28. |
| [37194786](https://app.aikido.dev/issues/37194786/detail?status=ignored) | postcss | Fixed in code, 8.5.28. |
| [27302357](https://app.aikido.dev/issues/27302357/detail?status=ignored) | picomatch | Fixed in code with major-preserving patches 2.3.2 and 4.0.7. |
| [43642527](https://app.aikido.dev/issues/43642527/detail?status=ignored) | nanoid | Fixed in code, 3.3.18. |
| [28771710](https://app.aikido.dev/issues/28771710/detail?status=ignored) | zod | Fixed in code, 4.5.4. |
| [38998820](https://app.aikido.dev/issues/38998820/detail?status=ignored) | postcss path traversal | Fixed in code, 8.5.28. |
| [27980667](https://app.aikido.dev/issues/27980667/detail?status=ignored) | postcss XSS | Fixed in code, 8.5.28. |
| [35290548](https://app.aikido.dev/issues/35290548/detail?status=ignored) | inline-style-parser | Fixed in code, 0.2.9, as specified by Aikido's advisory. |
| [40563801](https://app.aikido.dev/issues/40563801/detail?status=ignored) | nanoid | Fixed in code, 3.3.18. |
| [39430846](https://app.aikido.dev/issues/39430846/detail?status=ignored) | nanoid | Fixed in code, 3.3.18. |
| [38119889](https://app.aikido.dev/issues/38119889/detail?status=ignored) | nanoid | Fixed in code, 3.3.18. |
| [44717670](https://app.aikido.dev/issues/44717670/detail?status=ignored) | openai webhook verification DoS | Vendor still resolves 6.34.0. Advisory requires attacker-supplied webhook signature headers reaching SDK verification. No SDK webhook unwrap/verifySignature endpoint found in this repo. Do not force a vendor-incompatible major upgrade to 7.6.0 solely for an unused API. Reassess before adding that API. |
| [35290549](https://app.aikido.dev/issues/35290549/detail?status=ignored) | nanoid | Fixed in code, 3.3.18. |
| [43642528](https://app.aikido.dev/issues/43642528/detail?status=ignored) | postcss-selector-parser | Fixed in code, compatible v6 patch 6.1.3. |
| [35290553](https://app.aikido.dev/issues/35290553/detail?status=ignored) | recharts Sankey DoS | Recharts remains 2.15.4. App does not import/use Sankey or expose attacker-supplied dense Sankey graphs. Reassess before adding Sankey rather than force the unrelated v3 migration. |
| [29227120](https://app.aikido.dev/issues/29227120/detail?status=ignored) | Archived jQuery/DOM XSS | Archived scraper uses Cheerio server-side parsing, not a live browser jQuery execution sink. |

## Verification

- Installed the updated dependency graph before testing.
- Full npm advisory database audit through `pnpm audit --json`: zero critical, high, moderate, low or informational advisories across production and development dependencies.
- This does not replace Aikido: Aikido-only advisories were checked separately against its proposed versions.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`: passed, 726 tests across 28 files.
- `pnpm build`: passed, including Vite, 164 prerendered pages and SEO audit of 165 routes. SEO output: zero errors, 67 warnings and one orphan route. These content warnings are not new security regressions.
- Security regressions include 25 JavaScript checks and three Python tests with additional subcases.
- jsPDF smoke test: created a two-page PDF and produced a nonempty ArrayBuffer.
- Browser preview: home, Morph Guide and nested Axanthic route loaded successfully.
- Native XML parsed with xmllint; Swift source parsed with swiftc.
- Workflow YAML parsed and checked for SHA pins, checkout credential isolation, default read permissions and push-step credential availability.
- Genetics consistency check passed. Git diff whitespace check passed.

## Remaining release verification

Aikido must scan the new main commit to confirm closures; historical-secret and non-actionable findings need a reasoned manual disposition. No alerts were hidden to make the queue appear clean.

Native app changes require rebuilding and distributing Android/iOS binaries. XML/Swift syntax checks are not native device tests; verify launch, sign-in callback, image sharing and background snapshot privacy on devices before publishing native releases. Authenticated production upload and checkout flows were not exercised with a user's account during this review.

## Classification references

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys): legacy anon is a public client key; access is constrained by RLS. The Supabase skill guided the client/server key boundary check and exact SDK version pin.
- [IndexNow documentation](https://www.indexnow.org/documentation): site ownership verification requires a publicly hosted key file.
- [Android FileProvider](https://developer.android.com/reference/androidx/core/content/FileProvider): private provider plus temporary URI grants.
- [Android backup controls](https://developer.android.com/identity/data/autobackup): explicit cloud and device-transfer exclusions.

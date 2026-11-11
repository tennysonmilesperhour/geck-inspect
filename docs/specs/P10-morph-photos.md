# P10: Community Morph Photo Contributions

> **Status, 11 November 2026: Built.** Live since 2 October 2026 (`src/pages/MorphGuideSubmission.jsx`, `src/lib/morphPhotoSubmissions.js`). Review is a tab in the Admin panel, not its own address.

**Priority:** P10 (Low, build only after morph guide is fully established)
**Dependencies:** Existing Morph Guide
**Origin:** iHerp analysis, community-contributed species gallery

---

## What It Is

Allow users to submit photos to the morph reference guide (the Morphpedia equivalent). Submissions go through admin review before publishing. Photos credited to submitter. Useful for expanding the morph guide with real-world examples from the community.

---

## Claude Code Prompt

```
Add a "Submit a photo" button on morph guide pages.

Submission form: photo upload, morph selection, brief description,
"I confirm I own the rights" checkbox.

Admin review queue at /admin/photo-submissions.

On approval: photo appears on morph guide page credited to submitter's display name.
```

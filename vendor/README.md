# vendor/

Third-party packages we install from a local tarball rather than a registry.
Each tarball is a checked-in build artifact, referenced by relative path
from `package.json` (e.g. `"crested-gecko-app": "file:vendor/foo.tgz"`).

## Why vendor instead of publish?

`crested-gecko-app` is the Foundation Genetics module that backs the
breeding calculator. It's pre-1.0, undergoing fast iteration with
breeders, and not stable enough to publish to npm yet. Vendoring keeps
the consuming app reproducible across machines and CI without paying
for a private registry.

## Updating a vendored package

1. Build the new tarball in the source repo: `npm pack`.
2. Drop it in here, replacing the prior version.
3. If the version number changed, update the `file:vendor/...` path in
   `package.json` to match.
4. `pnpm install` to refresh `pnpm-lock.yaml`.
5. Commit the new `.tgz`, the `package.json` change, and `pnpm-lock.yaml`
   in the same commit.

## When to graduate a package out of here

When the package is stable enough that we'd consider its API frozen for
~3 months at a time, publish it to npm (public or `@geckinspect`-scoped
private) and replace the `file:vendor/...` path with a semver range.

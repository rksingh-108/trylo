# Builds the TRYLO API (apps/api) for the private 2-person Azure test.
#
# The RUNTIME image (the "runner" stage, i.e. what actually ships/runs) is
# node:20-bookworm-slim (glibc), not alpine: Prisma's query engine needs a
# glibc + openssl runtime, and using alpine would require adding an explicit
# `binaryTargets` override to prisma/schema.prisma just to work around musl -
# staying on Debian avoids touching the schema at all.
#
# The BUILD-only stages below (pruner/installer, never shipped) use
# node:22-bookworm-slim instead: this repo's pinned `pnpm@11.18.0`
# (package.json "packageManager") hard-requires Node >=22.13 to even run
# (`corepack prepare pnpm@11.18.0` throws ERR_UNKNOWN_BUILTIN_MODULE on
# node:sqlite under Node 20 - confirmed empirically). Using an older pnpm
# to match Node 20 wasn't an option either: it would read the same
# pnpm@11-generated lockfile with a different lockfile-format expectation
# and risk a `--frozen-lockfile` mismatch. The deployed container is still
# exactly node:20-bookworm-slim; only the disposable build stages differ.
#
# Uses `turbo prune` to extract only what apps/api actually needs (itself +
# @trylo/types) out of this pnpm/turborepo monorepo, instead of copying
# every app/package into the build context.

FROM node:22-bookworm-slim AS build_base
# openssl must be present BEFORE `pnpm install` runs @prisma/engines'
# postinstall (which detects libssl to pick the right query-engine binary) -
# installing it later wouldn't help, since the wrong engine would already be
# downloaded and `prisma generate` reuses it rather than re-detecting.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# ---- 1. Prune the monorepo down to apps/api's real dependency graph ----
FROM build_base AS pruner
WORKDIR /repo
COPY . .
RUN npx -y turbo@2.10.7 prune api --docker

# ---- 2. Install deps (cached by the pruned lockfile) + build ----
FROM build_base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN corepack prepare pnpm@11.18.0 --activate \
  && pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
# `turbo prune` only copies the workspace packages it selected (api +
# @trylo/types) plus root manifest files (package.json/lockfile/turbo.json) -
# it does NOT know about tsconfig.base.json, which both packages' tsconfig.json
# reach via a relative `extends: "../../tsconfig.base.json"` outside any
# package directory. Without this, `tsc` fails with TS5083 (confirmed
# empirically). Copy it from the pruner stage's untouched full checkout.
COPY --from=pruner /repo/tsconfig.base.json ./tsconfig.base.json
# @trylo/types has no runtime code (interfaces/types only) but does need its
# own `tsc` pass so apps/api's compiled dist/index.js can `require()` real
# .js at runtime instead of raw .ts (Node 20 has no built-in TS support).
RUN pnpm --filter @trylo/types build
RUN pnpm --filter api exec prisma generate --schema=prisma/schema.prisma
RUN pnpm --filter api build

# ---- 3. Slim runtime image ----
FROM node:20-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 trylo \
  && useradd --system --uid 1001 --gid trylo trylo
WORKDIR /repo
COPY --from=installer --chown=trylo:trylo /repo .
USER trylo
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]

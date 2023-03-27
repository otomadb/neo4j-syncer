# syntax=docker/dockerfile:1

# Builder
FROM denoland/deno:1.31.1 AS builder

WORKDIR /app

COPY deno.jsonc deno.lock main.ts ./
RUN deno task compile

# Runner
# hadolint ignore=DL3006
FROM gcr.io/distroless/static-debian11 AS runner

WORKDIR /app

COPY --from=builder /app /

CMD ["/neo4j-syncer"]

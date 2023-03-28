# syntax=docker/dockerfile:1

FROM denoland/deno:distroless-1.32.1

WORKDIR /app

COPY deno.jsonc deno.lock main.ts ./

CMD ["task","run"]

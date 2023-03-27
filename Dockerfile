# syntax=docker/dockerfile:1

# Builder
FROM python:3.10-slim AS builder

ENV POETRY_HOME="/opt/poetry"
ENV PATH="$POETRY_HOME/bin:$PATH"

WORKDIR /app

RUN apt-get update && \
  apt-get install --no-install-recommends -y curl && \
  apt-get clean

RUN curl -sSL https://install.python-poetry.org/ | python - --version 1.4.0

COPY poetry.lock pyproject.toml ./
RUN poetry install --no-dev

COPY ./main.py ./

CMD ["poetry", "run", "python", "main.py"]

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o kpi-server .

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.19

# timezone Asia/Ho_Chi_Minh
RUN apk add --no-cache tzdata ca-certificates
ENV TZ=Asia/Ho_Chi_Minh

WORKDIR /app
COPY --from=builder /app/kpi-server .

EXPOSE 8080
CMD ["./kpi-server"]

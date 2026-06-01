# S3 attachment uploads — browser CORS

Direct browser uploads use a presigned `PUT` to S3 after `POST /api/attachments/sign-upload` succeeds. If sign-upload returns **200** but the upload fails in the browser, check the **S3 bucket CORS** configuration (not the Next.js app).

## Typical failure

| Step | Request | Expected |
|------|---------|----------|
| 1 | `POST /api/attachments/sign-upload` | 200 — app issued presigned URL |
| 2 | `OPTIONS` → `https://<bucket>.s3.<region>.amazonaws.com/...` | **403** — CORS preflight blocked |
| 3 | `PUT` to S3 | Never runs if preflight fails |

**Root cause:** `AllowedOrigins` on the bucket does not include the exact origin the browser uses (scheme + host + port), e.g. `http://172.30.30.96:5420`.

## Required bucket CORS

Use `docs/s3-bucket-cors.json` (adjust origins for your environments). Add every origin users open in the browser:

- `http://localhost:3000` — local dev
- `http://172.30.30.96:5420` — internal HTTP production (example)
- `https://your-portal.example.com` — when HTTPS is used

`AllowedMethods` must include **PUT** (upload) and **GET** (download via presigned GET). **HEAD** and **POST** are included for compatibility with some clients and tooling.

## Apply with AWS CLI

```bash
aws s3api put-bucket-cors \
  --bucket YOUR_BUCKET_NAME \
  --cors-configuration file://docs/s3-bucket-cors.json
```

Verify:

```bash
aws s3api get-bucket-cors --bucket YOUR_BUCKET_NAME
```

## AWS Console

S3 → bucket → **Permissions** → **Cross-origin resource sharing (CORS)** → paste the `CORSRules` array from `docs/s3-bucket-cors.json`.

## App environment (server-side only)

These variables are used for presigned URLs and health checks; they do **not** replace bucket CORS:

```env
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=prpo-sv
```

When deploying to a new host/port, update **bucket CORS** `AllowedOrigins`; no application code change is required for CORS alone.

## After changing CORS

1. Wait up to `MaxAgeSeconds` (3000) or test in a fresh Incognito window.
2. Retry upload on a PR/PO/APRI attachment tab.
3. In DevTools → Network, confirm S3 `OPTIONS` returns **200** and `PUT` returns **200**.

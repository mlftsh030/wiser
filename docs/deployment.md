# Deployment

The deployed shape is one Vercel project holding three things:

```
GitHub  ->  Vercel  ┬─  React application (static, built by Vite)
                    ├─  /api/assessments  ->  online spreadsheet
                    └─  /api/explain      ->  Gemini
```

Nothing else runs. There is no separate backend, no database, no container and
no local process. A reviewer opens the URL and uses the tool.

## What is optional

Both integrations are optional, and the product is complete without either.

| Not configured | What happens | Does the customer notice? |
|---|---|---|
| Spreadsheet | The function answers `501 not_configured` and the client ignores it | No |
| Gemini | The function answers `used: false` and the client uses the deterministic template | No |
| Both | The full journey, result and PDF still work | No |

This is deliberate. The customer's result and their PDF are produced entirely in
the browser from the deterministic engine, so nothing they depend on can be
missing.

## Deploying

1. Push the repository to GitHub.
2. Import it into Vercel. The framework preset is Vite; the build command
   (`npm run build`) and output directory (`dist`) are already in
   `vercel.json`.
3. Add whichever environment variables you want from the table below.
4. Deploy.

Functions in `api/` are picked up automatically. They are plain `.mjs` modules
with no build step, which is why they are JavaScript rather than TypeScript.

## Environment variables

All of these are **server-side**. None is prefixed `VITE_`, and that matters:
anything with that prefix is compiled into the client bundle and is therefore
public. These are read only inside the functions in `api/`.

| Variable | Purpose | Required |
|---|---|---|
| `GOOGLE_SHEETS_ID` | Which spreadsheet to append to | For persistence |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The service account identity | For persistence |
| `GOOGLE_PRIVATE_KEY` | Its private key | For persistence |
| `GOOGLE_SHEET_NAME` | Tab name, defaults to `Assessments` | No |
| `GEMINI_API_KEY` | Enables the AI narrative | For AI |
| `GEMINI_MODEL` | Defaults to `gemini-2.0-flash` | No |

There is one client-side variable, and it is a feature flag rather than a
secret:

| Variable | Purpose |
|---|---|
| `VITE_DISABLE_AI` | Set to `true` to skip the AI request entirely, for a fully offline demo |

## Setting up the spreadsheet

The sheet is Google Sheets, which is Excel-compatible: it opens in Excel and
exports to .xlsx from the File menu. It was chosen over a Microsoft Graph
workbook because a service account needs no directory administrator and no admin
consent, so a reviewer can stand the whole thing up themselves in a few minutes.

1. **Create a Google Cloud project** and enable the **Google Sheets API** on it.
2. **Create a service account** in that project. No roles are needed: access is
   granted by sharing the sheet, not by IAM.
3. **Create a JSON key** for the service account and download it. This is the
   only copy; treat it as a password.
4. **Create the spreadsheet.** A blank one is fine. The function writes the
   header row itself on the first assessment.
5. **Share the sheet with the service account address** (it ends in
   `.iam.gserviceaccount.com`) as an **Editor**. This step is the one most
   easily missed, and its absence is the usual cause of a permission error.
6. **Set the environment variables** in Vercel:
   - `GOOGLE_SHEETS_ID` is the id in the sheet URL, between `/d/` and `/edit`.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` is `client_email` from the JSON key.
   - `GOOGLE_PRIVATE_KEY` is `private_key` from the JSON key, pasted exactly as
     it appears including the `BEGIN` and `END` lines.

   On that last one: a PEM key is multi-line but an environment variable is a
   single string, so what arrives depends on how it was pasted. The function
   handles all the usual forms: escaped `\n` sequences as they appear in the
   JSON file, real newlines, CRLF from a Windows paste, and a value wrapped in
   quotes. Paste it verbatim rather than reformatting it. Getting this wrong is
   the usual cause of an "invalid PEM formatted message" error on first deploy,
   which is why it is handled rather than merely documented.

## Setting up Gemini

1. Create an API key in Google AI Studio.
2. Set `GEMINI_API_KEY` in Vercel.

That is the whole setup. The key stays server-side, and the function returns
`used: false` rather than an error whenever it cannot help, so a missing,
invalid or rate-limited key degrades to the template rather than breaking
anything.

## Running locally

```bash
npm install
npm run dev
```

This runs the app but not the functions, so the spreadsheet write fails silently
and the narrative falls back to the template. Neither changes what the customer
sees, which makes it a perfectly good way to develop.

To run the functions too:

```bash
npx vercel dev
```

Environment variables can go in `.env.local`, which is gitignored. Never commit
a key.

## Security posture

This is a graduate-programme MVP and is **not production-ready from a security
or POPIA compliance perspective**. Stating that plainly is more useful than
implying otherwise.

**What is handled:**

- **Nothing sensitive is logged.** Errors from the Sheets and Gemini calls are
  reduced to a scrubbed one-line summary before they reach the platform log. The
  error objects these clients throw carry the failed request, which can include
  an `Authorization` header or the signed assertion the private key produced, so
  logging the object itself would write credentials into the log. PEM blocks,
  bearer tokens, API keys and JWTs are redacted, and the line is length-capped.

- **No secrets in the browser.** Credentials live only in server-side
  environment variables read inside `api/`. The browser cannot modify the
  spreadsheet even with full knowledge of everything it received.
- **No PII collected or stored.** No name, identity number, address, contact
  details, employer, date of birth or banking information. The record type has
  no field for any of it.
- **Validation before persistence.** Unknown fields, personal-looking fields,
  invalid recommendations and non-finite numbers are all rejected before
  anything is written, and formula-like text is neutralised.
- **Graceful failure.** Persistence and AI are optional at runtime; either being
  unavailable costs the customer nothing.
- **A narrow AI surface.** The explanation function rebuilds its prompt from a
  fixed set of already-calculated fields rather than forwarding what it was
  posted, and validates the response before it is shown.
- **AI output validated twice.** The same guard runs in the function and again
  in the browser, so nothing reaches a customer unchecked even if the endpoint
  is misconfigured or replaced. It rejects empty output, output outside sensible
  length bounds, guarantee language, and any narrative that urges the opposite
  of what the engine decided.

**What is not:**

- **No consent flow.** Assessments are stored without asking. This is defensible
  only because nothing stored identifies anyone, and it would not be defensible
  the moment that changed.
- **No rate limiting or abuse protection** on either public endpoint. A
  determined caller could fill the sheet with junk rows.
- **No key rotation.** The service account key is long-lived, held in an
  environment variable, with no rotation schedule.
- **No audit logging** of who reads the spreadsheet.
- **No retention or deletion policy.** Rows accumulate indefinitely.
- **No POPIA assessment.** No lawful basis recorded, no Information Officer, no
  subject access or deletion process.
- **The engine runs client-side**, so the calculation is not tamper-proof. It is
  deterministic and auditable in source, but a determined user could run
  modified code in their own browser. Nothing depends on them not doing so.

See [data-model.md](data-model.md) for what is stored and why, and what a
production deployment would require.

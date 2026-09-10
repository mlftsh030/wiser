# Architecture

## The dependency rule

```
UI  →  services  →  calculations  →  config
```

Dependencies point one way only. **The financial core imports nothing from the
UI, and has no idea a UI exists.**

Enforced by convention and made visible by directory:

- `calculations/` — pure functions. No React, no `fetch`, no `window`.
- `services/` — orchestration and I/O.
- `pages/`, `components/` — rendering only.

The practical payoff is that the entire financial engine is testable without
rendering anything, and 188 tests run in about a second.

The same rule extends to the two newer outputs. `services/report/` turns a
finished report into a PDF and `api/` writes the internal record, and neither
can reach back into the engine.

## The pipeline

```
Assessment  ->  CalculatedMetrics  ->  DecisionResult  ->  ReportModel
                                                              │
                                        ┌─────────────────────┼─────────────────────┐
                                        ▼                     ▼                     ▼
                                       UI                    PDF            internal record
```

Four plain data structures. Each stage is a pure transformation of the previous
one, which means any stage can be tested by constructing its input directly, and
the whole pipeline is deterministic, a property asserted by test.

`services/reportBuilder.ts` is the single entry point. It runs the deterministic
core to completion *before* requesting a narrative, guaranteeing the numbers
exist and are final before any optional AI is involved.

**There is one source of truth.** The UI, the PDF and the internal record are
three readers of the same finished `ReportModel`. None of them recalculates
anything, which is why the PDF cannot disagree with the screen and why the
stored row cannot disagree with either. The PDF tests assert exactly this: the
figures in the document are the ones the engine produced.

## Module responsibilities

Single responsibility, in practice:

| Module | Owns |
|---|---|
| `mortgage.ts` | Repayment, amortisation, outstanding balance |
| `transactionCosts.ts` | Transfer duty, attorney fees, selling costs |
| `ownership.ts` | Full monthly cost of owning |
| `affordability.ts` | Surplus and resilience |
| `comparison.ts` | Buy vs rent over a horizon |
| `scenarios.ts` | Running the comparison under varied assumptions |
| `scoring.ts` | Section scores (communication only) |
| `decisionEngine.ts` | The three-stage hierarchy |
| `levers.ts` | What the customer could change |
| `metrics.ts` | Pipeline orchestration — the only module that knows the order |

Each is independently testable because none reaches for anything it was not
given.

## The two extension points

Two boundaries exist specifically so today's simple choice does not become
permanent.

### AssessmentRepository

```
AssessmentRepository (interface)
  ├── SpreadsheetRepository    <- today: POSTs to our own serverless function
  ├── NoopRepository           <- persistence switched off, and tests
  └── DatabaseRepository       <- later, no engine change
```

The browser implementation is deliberately thin. It flattens the report into a
row, posts it to `/api/assessments`, and translates the response into one of
three outcomes. It holds no credentials, no spreadsheet id and no provider
details, because a token that can write to the internal record must never be
shipped to a client.

`services/storage/recordMapper.ts` separates *flattening a report into a row*
from *writing that row anywhere*, so the same mapping serves the spreadsheet, a
database, an API payload or a CSV unchanged.

Note the return type. `save()` resolves to a `SaveOutcome` of `saved`,
`not_configured` or `failed` rather than throwing, because two of those three
are not failures: running with no spreadsheet configured is a supported
deployment, and even a genuine failure must leave the customer untouched.

### ExplanationService

```
ExplanationService (interface)
  ├── TemplateExplanationService   <- default, deterministic, free
  └── RemoteExplanationService     <- calls /api/explain, falls back to template
```

`createExplanationService()` picks one at runtime. Note what changed and why:
the browser can no longer decide whether AI is available, because the key is
server-side and must stay there. So it always asks the function, and the
function decides. When AI is switched off the function answers `used: false`
immediately and the remote service falls back to the template, which is why a
deployment with no key behaves exactly like the default product.

`RemoteExplanationService.source` is mutable for the same reason. It reports
what the customer actually got rather than what was attempted, so
`reportBuilder` reads it *after* `explain()` resolves.

## Where SOLID actually applied

Applied where it earned its place, not demonstratively:

- **Single responsibility** — the module table above.
- **Open/closed** — adding a fourth scenario means appending to the `SCENARIOS`
  array. The engine, the robustness calculation and the UI all derive from that
  list and need no changes.
- **Dependency inversion** — the engine depends on `Assumptions` (data) rather
  than reading config directly; `buildReport` accepts an injected
  `ExplanationService`, which is how the failure path is tested.
- **Interface segregation** — `ExplanationService` has one method.

Deliberately **not** applied: no abstract base classes, no factory hierarchies,
no dependency-injection container, no repository for things with one
implementation and no prospect of a second. Abstractions added to demonstrate
SOLID rather than to solve a problem are just cost.

## State management

Plain React state, in one hook (`useAssessmentJourney`). No Redux, no Zustand, no
context.

The journey is a short linear flow with a single draft object. A state library
would add a dependency, indirection and boilerplate to solve a problem this
application does not have.

## Error handling

Three layers, each with a different job:

1. **Validation** stops bad financial data before it reaches the engine.
2. **Graceful degradation** — a failed AI call falls back to the template; a
   failed write to the internal record is skipped silently. Neither costs the
   customer their report or their PDF.
3. **Error boundary** catches anything unexpected in rendering and shows a calm
   message. Customers never see a stack trace.

The principle: **the customer's report is the product.** Everything optional
fails quietly around it.

## Performance

- Calculations run synchronously in the browser in well under a millisecond.
- No API calls are required in the default configuration.
- pdf-lib, by far the largest dependency, is dynamically imported, so it loads
  only when a customer actually downloads their report. The initial bundle is
  93KB gzipped; the PDF chunk is a further 176KB that most of the journey never
  fetches.
- Closed-form amortisation instead of month-by-month tables.

## The two outputs

The change that most shaped the current architecture is that the customer's
record and our record are different artefacts with different failure modes.

| | Customer PDF | Internal record |
|---|---|---|
| Built | In the browser, from the report on screen | In a serverless function, from a posted row |
| Depends on | Nothing external | A configured spreadsheet |
| On failure | The customer sees a message and can retry | Nobody is told, and nothing is lost |
| Contains | The full analysis and reasoning | A flat row for analysis |

That asymmetry is deliberate. The PDF is the product, so it is generated where
nothing can fail: no network, no credentials, no third party. The internal
record is ours, so it is allowed to fail quietly.

### The PDF is split in two

```
ReportModel
  -> buildReportDocument()   pure: report -> document structure
  -> renderReportPdf()       layout only, via pdf-lib
```

`reportDocument.ts` is a pure function with no pdf-lib, no DOM and no I/O, which
is what lets the tests assert the content of a customer's report without
rendering a single byte. `pdf.ts` is a layout engine that receives a finished
document, so it has no access to the assessment and no way to produce a figure
of its own.

Two details worth noting in the renderer. The standard PDF fonts are WinAnsi
encoded, so `formatCurrency`'s non-breaking spaces and the copy's typographic
punctuation are normalised at draw time rather than compromising how text looks
on screen. And page breaks are handled by reserving space before each block,
which is why a field and its explanatory note never split across a page.

## Serverless functions

Two functions, both plain JavaScript with no build step, because Vercel runs
`api/` as standalone Node modules.

- **`api/assessments.mjs`** validates the posted record and appends one row.
- **`api/explain.mjs`** holds the Gemini key and rewrites already-calculated
  facts.

Three details worth noting:

- **Credentials never leave the server.** Both functions read their
  configuration from environment variables inside the handler. Nothing is
  prefixed `VITE_`, so nothing reaches the client bundle.
- **The column list is duplicated on purpose.** The function cannot import from
  `src/`, so `api/_lib/record.mjs` repeats the column order as a plain list. A
  contract test compares the two lists, which is what stops them drifting apart
  silently rather than trusting a comment to do it.
- **Appending is a single API call.** The local workbook this replaced needed a
  promise chain to serialise concurrent writes, because two assessments
  finishing at once would each read the file, append a row, and the second write
  would overwrite the first. Sheets serialises appends itself, so that whole
  class of bug is gone rather than guarded against.

`api/explain.mjs` also rebuilds its prompt payload from a fixed set of fields
rather than forwarding the posted body, so a caller cannot smuggle extra content
into the prompt.

### Two details that are easy to get wrong

- **Errors are scrubbed before they are logged.** The errors an auth or HTTP
  client throws are not plain messages: they carry the request that failed,
  which can include an `Authorization` header or the signed assertion the
  private key produced. `api/_lib/safeError.mjs` reduces any thrown value to a
  status and a redacted, length-capped message, and nothing else is ever passed
  to `console.error`.
- **Environment variables are read per request, not at module load.** A
  serverless instance is reused across invocations, so a value captured at load
  time would survive an environment change until the instance was recycled.

### The AI guard runs twice

`api/_lib/explanationGuard.mjs` and `src/services/explanation/guard.ts` are the
same rules in two places. The function is the real check; the client repeats it
so that nothing reaches a customer unvalidated even if the endpoint is
misconfigured or replaced. A test asserts the two agree.

The rule worth noting is that the hedged answer, `BUYING_MAY_WORK`, constrains
both directions. It is precisely the result a confident sentence either way
would misrepresent, and leaving it unconstrained was a real gap.

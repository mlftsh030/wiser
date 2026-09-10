# Just Wiser

> **Driven by better financial decisions.**

An indicative buy-vs-rent decision-support tool for the South African market.

Just Wiser does not tell you whether to buy a house. It helps you understand
your own situation well enough to decide for yourself.

---

## The problem

The brief was:

> Build a simple tool where a customer answers questions and receives advice on
> whether to buy or rent a house given their situation.

The obvious reading is `inputs → BUY / RENT`. That reading is wrong, for a
reason that matters: there is no universally correct answer to this question.
Two people with identical finances should get different answers if one expects
to emigrate in two years and the other is raising a family in one place.

A tool that returns a verdict hides that. A customer who is told "RENT" learns
nothing, cannot tell whether the tool understood them, and has no idea what
would change the answer.

So Just Wiser is built as a **decision-support journey**:

```
Understand the situation → Analyse the finances → Understand the circumstances
→ Compare buying and renting → Test different futures → Explain the trade-offs
→ Show what could change the outcome
```

The output is not a verdict. It is an explanation the customer can argue with.

---

## Product philosophy

Four principles drive every design decision in this codebase.

**1. Explain, don't dictate.** The result is phrased as "Based on the
assumptions you provided, buying looks financially attractive", never "You
should buy". Every recommendation is accompanied by the reasoning that produced
it.

**2. Show what is driving the result.** The report opens with the single
strongest factor and the single biggest risk, both drawn from the model. Four
section scores show at a glance which parts of a situation are strong.

**3. Give the customer agency.** Every result includes *What could change the
result?* — concrete, calculated levers ("building roughly R80,000 more in
accessible savings would leave you with about 3 months of expenses"). These are
computed from the model, never invented.

**4. Be honest about uncertainty.** The same comparison runs under three
different views of the future. When they disagree, the report says so
prominently rather than presenting one projection as fact.

### Two lenses

**The customer** wants to understand their own position. That is the journey
described above.

**The system** should learn from the aggregate. Every completed assessment is
written to an online Excel-compatible spreadsheet (inputs, calculated metrics,
scenario results, scores, recommendation) so that patterns can be studied: what
most commonly blocks buying, how savings affect outcomes, how often customers
are financially ready but personally prefer renting.

These two lenses produce two separate outputs, and the distinction matters:

| | Customer output | Internal record |
|---|---|---|
| **What** | A detailed PDF report | One row in an online spreadsheet |
| **For** | The customer, to keep and to discuss | Us, to study patterns across assessments |
| **Contains** | The full analysis and reasoning | Flat inputs, metrics, scores, recommendation |
| **When it fails** | The customer notices, and can retry | Nobody notices, and nothing is lost to them |

The customer never sees the spreadsheet and never needs to know it exists.

To be careful about what that data can and cannot show: it captures financial
circumstances, stated preferences and expectations. It does **not** reveal how
people think. See [docs/data-model.md](docs/data-model.md).

---

## The model

The analysis is built on three explicit dimensions, because a purchase can fail
on any one of them independently.

| Dimension | Question it answers | Inputs |
|---|---|---|
| **Financial position** | Can they safely afford it? | income, expenses, debt, savings, deposit, bond, ownership costs, surplus |
| **Personal circumstances** | Does it fit their life? | expected stay, mobility, flexibility, ownership preference, risk tolerance, priorities |
| **Market & time dynamics** | How could it change over time? | interest rate, rental growth, property growth, maintenance, transaction costs, opportunity cost |

The core relationships:

```
S_m = I − E − D                    Monthly surplus before housing
S_h = I − E − D − H                Monthly surplus after housing
M   = L·i(1+i)^n / ((1+i)^n − 1)   Bond repayment (Excel PMT)
H   = M + rates + insurance + maintenance + levies
S_R = S − DP − C                   Savings remaining after purchase
B   = S_R / (E + D)                Buffer, in months of commitments
```

Full detail: [docs/financial-model.md](docs/financial-model.md).

### What makes the comparison honest

The most common flaw in buy-vs-rent calculators is comparing a bond repayment
with rent. That is not the real comparison, and it flatters buying twice over.

Just Wiser compares two complete strategies by **end-state net worth**:

- **Buying**: spend the deposit and purchase costs now, pay the full ownership
  cost monthly, end with equity in a property *less the cost of selling it*.
- **Renting**: keep that same capital invested, pay rent, and invest the monthly
  difference between renting and owning.

Crediting the renter with investment growth on money they did not spend is what
stops the model from producing a foregone conclusion. Transfer duty, attorney
fees and the ~6% cost of selling are all modelled, which is why short holding
periods legitimately favour renting.

---

## The decision engine

Deliberately **not** a weighted score with a threshold. Money does not work that
way — a strong personal preference cannot make an unaffordable bond affordable.
So the engine is a hierarchy where each stage constrains the next.

**Stage 1 — Financial safety (a gate, not a factor).** Can the monthly cost be
met? Is there enough cash to complete the transfer? Does a buffer survive? Fail
any of these and the answer is "rent for now", regardless of everything else.

**Stage 2 — Financial comparison.** Which strategy leaves them better off over
their actual expected stay, across all three scenarios.

**Stage 3 — Personal circumstances.** May move the answer *one step*, and only
when the financial comparison is not already decisive. Preference can break a
tie; it cannot overturn the numbers.

The three outcomes are `BUYING_LOOKS_ATTRACTIVE`, `BUYING_MAY_WORK` and
`RENT_FOR_NOW`.

The engine returns an **explainable decision object**, not a string:

```ts
{
  recommendation: 'BUYING_MAY_WORK',
  reasons: [{ category, statement, impact, weight }, ...],
  risks:   [{ statement, severity }, ...],
  whatCouldChange: [{ statement, category }, ...],
  robustness: { supporting: 2, total: 3, sensitive: true },
  strongestFactor, biggestRisk,
}
```

The UI renders this. It never composes reasoning of its own.

Full detail: [docs/decision-engine.md](docs/decision-engine.md).

### On the section scores

The report shows four scores out of 10. **These are communication tools, not the
algorithm.** The engine reads the underlying metrics directly; the scores exist
so a customer can see where they stand at a glance.

This is deliberate and tested: an 8/10 personal-fit score never causes a "buy"
on its own. A customer can quite legitimately see a *strong* personal fit
alongside a "rent for now" recommendation, because the money did not work.

---

## Architecture

```
                         CUSTOMER
                            │
                    RESPONSIVE WEB UI            <- React only, no business logic
                            │
                    DECISION ENGINE
                            │
                    FINANCIAL MODEL
                            │
                    SCENARIO ENGINE
                            │
                    EXPLAINABLE RESULT (ReportModel)
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    DETAILED PDF     ExplanationService   AssessmentRepository
   (the customer's     ├── Template          │
    own record)        └── Remote (AI)       ▼
                            │          /api/assessments   <- serverless
                            ▼                 │
                      /api/explain            ▼
                       (Gemini)        Online spreadsheet
```

Everything below `ReportModel` is a consumer of results that are already final.
The PDF, the narrative and the internal record all read the same numbers, so
none of them can disagree with what the customer saw on screen.

The dependency rule: **the UI depends on the engine; the engine depends on
nothing.** Every calculation module is a pure function of its inputs, which is
why the entire financial core is testable without rendering anything.

Two boundaries are drawn deliberately so today's simple choice is not permanent:

- `AssessmentRepository` - an online spreadsheet now, a database later, with no
  change to the engine.
- `ExplanationService` - template by default, AI when configured.

Full detail: [docs/architecture.md](docs/architecture.md).

---

## Financial assumptions

Every assumed value lives in [`src/config/assumptions.ts`](src/config/assumptions.ts).
Nothing financial is hard-coded anywhere else. SARS transfer duty bands are
isolated further, in [`src/config/transferDuty.ts`](src/config/transferDuty.ts),
because they are legislated and change in the annual Budget.

| Assumption | Value | Note |
|---|---|---|
| Default interest rate | 10.75% | Only when the customer doesn't know theirs; labelled in the report |
| Rental growth | 5%/yr | Broadly inflation |
| Property growth | 5%/yr | Nominal, national average |
| Investment return | 8%/yr | Applied to capital a renter keeps invested |
| Maintenance | 1% of value/yr | Long-run average |
| Insurance | 0.4% of value/yr | Building cover |
| Rates and taxes | 0.8% of value/yr | Varies by municipality |
| Cost of selling | 6% | Mostly agent commission |
| Transfer duty | SARS 2025/26 bands | Legislated |

Resilience bands (months of expenses covered) are 6 / 3 / 1 for
strong / moderate / limited. There is no universally correct emergency fund, so
these describe rather than prescribe — and the report says so.

Full detail and rationale: [docs/assumptions.md](docs/assumptions.md).

---

## AI

The AI layer is small, optional, and **cannot affect any number**.

**What it does:** takes facts the deterministic engine has *already* calculated
and rewrites them as two or three plain-English paragraphs. Gemini is the
provider, called from our own serverless function.

**What it cannot do:**

- invent or alter a number: it never receives the raw inputs
- change the recommendation: that is decided before it is called
- create financial assumptions or add advice
- override the decision engine
- present itself as a financial adviser

Four things enforce this. It runs *after* the deterministic pipeline is
complete. The serverless function rebuilds the prompt payload from a fixed set
of already-calculated fields, so nothing extra can be smuggled in. Its output is
validated before display (length, contradiction of the recommendation,
guarantee language) and rejected if it drifts. And any failure, whether no key,
a network error, a timeout or a bad response, falls back silently to the
deterministic template.

**The key never reaches the browser.** `GEMINI_API_KEY` is a server-side Vercel
environment variable read only inside [`api/explain.mjs`](api/explain.mjs). The
client posts already-calculated facts to `/api/explain` and receives either a
narrative or `used: false`, in which case it uses the template.

**With no API key the product is fully functional.** That is the default, and
the function returns `used: false` immediately when the key is absent.

---

## Data

There are two outputs, and they are not the same thing.

**The customer's record is the PDF.** It is generated in their browser from the
report they are looking at, contains the full analysis and reasoning, and is
theirs to keep. Nothing about it touches a server.

**Our record is one row in an online spreadsheet.** Raw inputs first, then
calculated metrics, then scenario results, then scores and the recommendation,
kept in that order so an analyst can tell what the customer said apart from what
the model concluded. The customer never sees it and does not need to know it
exists.

We collect **no personally identifying information**: no name, ID number,
address, contact details, employer, date of birth or banking details. Each
assessment gets a random reference like `D2942158`. This is a design decision,
not an omission: none of it is needed to answer the question, and collecting it
would create obligations without value.

Two mechanisms enforce it rather than merely documenting it. The record type is
a closed shape with no field for such data, and the serverless function rejects
any payload carrying an unexpected or personal-looking field before it reaches
the sheet. Both are tested.

Writing the row is best effort. It happens after the report exists, is never
awaited, and every failure path returns a status the UI ignores. A customer whose
row was never written gets exactly the same result and the same PDF.

Full detail: [docs/data-model.md](docs/data-model.md). Credentials and
environment variables: [docs/deployment.md](docs/deployment.md).

---

## Testing

```bash
npm test
```

**188 tests**, concentrated on the financial engine, since that is where an
error is both most likely and most costly. The 116 tests that covered the
financial core before the PDF and online-record work are unchanged and still
pass.

| Area | What is covered |
|---|---|
| Mortgage | Known-value check against the annuity/PMT result; zero and negative inputs; zero rate (the division-by-zero branch); term and rate monotonicity; balance reaching exactly zero at term |
| Transaction costs | Every SARS band; **continuity across each band boundary**; monotonicity; cash purchase vs bonded |
| Affordability | Comfortable, borderline and unaffordable cases; buffer measured against commitments; no `Infinity` when commitments are zero |
| Comparison | That the renter's capital compounds (the fairness property); short stays favouring renting; longer horizons improving buying; selling costs deducted |
| Scenarios | Correct conservative ≤ base ≤ optimistic ordering; no negative rates from adjustments |
| Decision engine | The four required paths; that Stage 1 is a genuine gate; that preference cannot overturn decisive economics |
| Coherence | Across 8 customer profiles: the recommendation never contradicts the scenario evidence, scores stay in range, and no value is ever `NaN` |
| Validation | Every rule, including that a warning does not block progress |
| Pipeline | End-to-end report; graceful degradation when the explanation service throws; determinism; no PII in the export |
| Customer PDF | Every required section present; the recommendation and figures match the engine rather than being recomputed; all three recommendation classes produce a complete document; assumed rate and assumed horizon are disclosed; no PII |
| Internal record | Every column mapped; all three scenarios recorded; raw inputs kept distinct from calculated values; no PII |
| Persistence | Network failure, an unconfigured spreadsheet and a server error each return a status instead of throwing; a failed write still leaves the customer their PDF |
| Validation (server) | Unknown fields, personal-looking fields, an invalid recommendation and non-finite numbers are all rejected; formula-like text is neutralised |
| AI | Failure, absence and rejected output all fall back to the template; the narrative never changes the recommendation or the numbers; raw inputs are never sent |
| Column contract | The client column list and the serverless column list cannot drift apart |
| Service account config | Escaped, real, quoted and CRLF private keys all normalise to a valid PEM; a missing variable reports "not configured" rather than failing; the sheet name defaults to `Assessments` |
| Safe logging | PEM blocks, bearer tokens and API keys are redacted; an error object's attached request is never echoed; log lines are length-capped |
| AI guard | Empty, too short, too long, malformed and guarantee-laden output all rejected; a narrative urging the opposite of the recommendation rejected for each of the three classes; the client and server guards agree |
| Determinism under AI | Across three profiles, the decision and metrics are byte-identical with the AI on and off, and a narrative that contradicts the engine is discarded rather than shown |

The coherence suite is worth calling out. It exists because an early version
could recommend "buying may work" while reporting that only 1 of 3 scenarios
supported it: internally inconsistent, and visible to the customer on the same
screen. Those tests now make that combination impossible.

The invariant the integration suite exists to protect is stated directly:
**same inputs, same calculations, same `DecisionResult`, whether Gemini is
enabled or not.** It is asserted across all three recommendation classes by
comparing the whole decision and metrics objects, not a sampled field.

Two of the newer suites follow the same principle of testing the property rather
than the implementation. The PDF tests assert that figures in the document are
the ones the engine produced, so the PDF cannot start computing its own. The
column-contract test compares the client's column list with the serverless
function's, because the function cannot import from `src/` and the two would
otherwise drift apart silently.

---

## Security

This is a graduate-programme MVP and is **not production-ready from a security
or POPIA compliance perspective**. What it does do:

- **No secrets in the browser.** Spreadsheet credentials and the Gemini key are
  server-side Vercel environment variables, read only inside `api/`. Nothing is
  prefixed `VITE_`, so nothing is compiled into the client bundle. The browser
  cannot modify the spreadsheet even if a user inspects every byte it received.
- **Validation before persistence.** The serverless function rejects unknown
  fields, personal-looking fields, invalid recommendations and non-finite
  numbers before anything is written, and neutralises text a spreadsheet would
  execute as a formula.
- **Nothing sensitive is logged.** Errors are reduced to a scrubbed one-line
  summary, because the errors an auth or HTTP client throws carry the failed
  request, which can include a token or the signed assertion the private key
  produced.
- **AI output validated twice**, in the function and again in the browser, so
  nothing reaches a customer unchecked.
- **No PII, by shape rather than by policy.** The record type has no field for
  it and the validator refuses it.
- **Graceful failure.** Persistence and AI are both optional at runtime. Either
  being unavailable costs the customer nothing.

What a production deployment would still need: explicit consent capture,
encryption at rest under our own key management, access control and audit
logging on the spreadsheet, a retention and deletion policy, rate limiting and
abuse protection on the public endpoints, and a POPIA assessment. See
[docs/deployment.md](docs/deployment.md).

---

## Running locally

```bash
npm install
npm run dev          # http://localhost:5173
```

That is all that is required. The app is fully functional with no further
setup: complete an assessment, see the result, download the PDF. There is no
server to start, no database and no build step beyond Vite.

What is missing locally is only what needs credentials. The `/api` functions do
not run under plain `vite dev`, so the internal spreadsheet write fails silently
and the AI narrative falls back to the deterministic template. Neither changes
what the customer sees.

To run the serverless functions locally as well:

```bash
npx vercel dev       # runs the app and the /api functions together
```

Other commands:

```bash
npm test             # run the test suite
npm run test:watch   # watch mode
npm run build        # production build
npm run preview      # serve the production build
npm run lint         # oxlint over src and api
```

---

## Deployment

The deployed shape is:

```
GitHub  ->  Vercel  ┬─  React application (static)
                    ├─  /api/assessments  ->  online spreadsheet
                    └─  /api/explain      ->  Gemini
```

Push to GitHub, import the repository into Vercel, and it builds. **A reviewer
needs nothing else**: no local server, no database, no Docker, no separate
backend. Open the URL and use the tool.

Both integrations are optional and configured entirely through Vercel
environment variables, none of which are prefixed `VITE_` and none of which
reach the browser:

| Variable | For | Required |
|---|---|---|
| `GOOGLE_SHEETS_ID` | Internal record | For persistence |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Internal record | For persistence |
| `GOOGLE_PRIVATE_KEY` | Internal record | For persistence |
| `GOOGLE_SHEET_NAME` | Internal record | No, defaults to `Assessments` |
| `GEMINI_API_KEY` | AI narrative | For AI |
| `GEMINI_MODEL` | AI narrative | No, defaults to `gemini-2.0-flash` |

With none of them set, the deployment still works end to end. The customer
completes an assessment, gets their result and downloads their PDF; the row is
simply not stored and the explanation is the deterministic template.

Step-by-step setup, including creating the service account and sharing the
sheet: [docs/deployment.md](docs/deployment.md).

---

## Project structure

```
src/
├── calculations/     Pure financial logic. No React, no I/O.
│   ├── mortgage.ts           Bond repayment, amortisation, balances
│   ├── transactionCosts.ts   SARS transfer duty, attorney fees, selling costs
│   ├── ownership.ts          Full monthly cost of owning
│   ├── affordability.ts      Surplus and resilience
│   ├── comparison.ts         Buy vs rent, by end-state net worth
│   ├── scenarios.ts          Conservative / base / optimistic
│   ├── scoring.ts            Section scores (communication only)
│   ├── decisionEngine.ts     The three-stage hierarchy
│   ├── levers.ts             "What could change the result?"
│   └── metrics.ts            Pipeline orchestration
├── config/           Every assumption, in one place
├── models/           Domain types (Assessment → Metrics → Decision → Report)
├── services/
│   ├── report/               The customer's PDF
│   │   ├── reportDocument.ts   Pure: report -> document structure
│   │   └── pdf.ts              Layout only, via pdf-lib
│   ├── explanation/          Template and remote (AI) narrative
│   ├── storage/              The internal record and its mapping
│   └── reportBuilder.ts      The single pipeline entry point
├── pages/            One page per step of the journey
├── components/       Presentational only
├── hooks/            Journey state
└── utils/            Formatting, validation
api/                  Vercel serverless functions
├── assessments.mjs           Writes one row to the online spreadsheet
├── explain.mjs               Calls Gemini, holds the key
└── _lib/                     Shared column list, validation, Sheets client
docs/                 Reasoning behind the design
```

The rule that keeps this navigable: **`calculations/` never imports from `pages/`
or `components/`.** Financial logic has no idea a UI exists.

---

## Limitations

Being explicit, because a financial tool that overstates itself is worse than
useless:

- **This is not financial advice.** It is an indicative decision-support
  prototype and does not account for individual circumstances a qualified
  adviser would consider.
- **It cannot predict the future.** Property growth, rental growth and interest
  rates are assumptions. The scenario range exists to make that visible, not to
  bound what is possible.
- **Attorney fees are approximated.** Real conveyancing and bond registration
  costs follow a stepped tariff; we model proportional-plus-fixed, which is close
  enough to inform a decision but is not a quote.
- **Tax is simplified.** No capital gains tax on sale, no primary-residence
  exclusion, no rental income, no tax treatment of investment returns.
- **One property, one rent.** No comparison across multiple properties or areas,
  and no regional variation in growth — a national average is used everywhere.
- **The bond is plain vanilla.** No access bond, no extra repayments, no
  variable-rate path, no fixed-rate option.
- **Affordability is not credit assessment.** A bank's decision uses credit
  history and its own scoring, and may differ substantially.
- **Inputs are self-reported** and not validated against anything.
- **The internal record has no consent flow.** Assessments are stored without
  asking, which is acceptable only because nothing stored identifies anyone.

## Future improvements

- Let customers adjust assumptions on the result page and watch the answer move —
  the single highest-value addition, since it turns the model into a thinking tool
- Sensitivity analysis showing which single assumption the answer is most fragile to
- Capital gains tax and the primary-residence exclusion
- Regional property growth from actual market data
- Access-bond and extra-repayment modelling
- A real database behind `AssessmentRepository`, with consent capture
- Emailing the PDF to a customer who asks for it, which would be the first
  feature to require handling personal information and a consent flow
- Aggregate analytics for the Lens 2 dataset
- Saving and revisiting an assessment as circumstances change

---

## A note on branding

This is a graduate-programme assignment and is not affiliated with, endorsed by,
or connected to any financial services provider. No third-party logos or branding
are used. "Just Wiser" appears as plain typographic text only.

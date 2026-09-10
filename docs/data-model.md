# Data model

What we store, what we deliberately do not, and what production would require.

## What an assessment record contains

One flat row per completed assessment, in three logical blocks kept in this
order so an analyst can tell what the customer *said* apart from what the model
*concluded*.

**Raw inputs** — exactly as entered:
`income`, `essential_expenses`, `existing_debt`, `savings`, `current_rent`,
`property_price`, `upfront_contribution`, `interest_rate`,
`interest_rate_assumed`, `loan_term`, `expected_stay`, `move_likelihood`,
`flexibility`, `ownership_preference`, `risk_tolerance`, `primary_priority`

**Calculated metrics** — derived by the engine:
`monthly_bond`, `monthly_ownership_cost`, `monthly_surplus`, `upfront_costs`,
`remaining_savings`, `emergency_buffer_months`, `projected_rent_cost`,
`projected_buying_cost`, `projected_equity`, `net_advantage_of_buying`

**Scores and decision**:
`financial_score`, `resilience_score`, `financial_outcome_score`,
`personal_fit_score`, `recommendation`, `recommendation_robustness`,
`scenario_sensitive`, `primary_reason`, `primary_risk`

Plus `assessment_id` and `timestamp`.

`interest_rate_assumed` matters more than it looks: without it, an analyst
cannot distinguish a customer's real quoted rate from our default, and would
draw conclusions from our own assumption.

## What we deliberately do not collect

No name. No ID number. No address. No email or phone. No bank account details.
No employer. No date of birth.

This is a design decision, not an oversight. **None of it is required to answer
the question the customer asked.** Collecting it would create real obligations —
consent, security, retention, subject-access — in exchange for no analytical
value.

Each assessment gets a random reference such as `D2942158`, generated with
`crypto.randomUUID()` and deliberately *not* derived from the customer's answers,
so it cannot be reversed into anything identifying.

A test asserts the exported record contains no field matching `name`, `email`,
`phone`, `id_number`, `address` or `surname` — so the guarantee cannot quietly
erode.

### The residual risk, stated honestly

A record still contains income, expenses, savings, property price and location-free
preferences. In a small enough population, a sufficiently unusual combination
could in principle be re-identifying. The MVP's mitigations are that we store no
direct identifiers and no location. A production system handling real volume
should treat these rows as personal information regardless, and the section below
assumes that.

## Lens 2: what the dataset can and cannot tell us

**It can** surface patterns worth acting on:

- what most commonly blocks a purchase — is it the deposit, the buffer, or the
  monthly cost?
- how expected holding period distributes, and how often it is the deciding factor
- how often customers are financially ready but personally prefer renting
- which inputs most often produce a scenario-sensitive result
- how far customers' target prices sit from what their income supports

**It cannot** tell us how people think. It records what they entered and what
they said they valued, on one occasion, in one tool. Stated preferences and
revealed behaviour differ, self-reported expenses are estimates, and the
population is self-selected — people already considering buying.

Overclaiming here would be the same error the product exists to avoid. The
defensible framing:

> The data allows us to identify patterns in financial circumstances,
> preferences and expectations that may help improve customer support and
> financial education.

## Two outputs, not one

The most important distinction in this document: the customer's record and our
record are different artefacts, produced differently, for different readers.

| | Customer PDF | Internal record |
|---|---|---|
| **What** | A detailed report of their own assessment | One row among many |
| **For** | The customer | An analyst studying patterns |
| **Where** | Generated in their browser, saved to their device | An online Excel-compatible spreadsheet |
| **Contains** | Their figures, the comparison, scenarios, reasoning, risks, assumptions and limitations | Flat inputs, calculated metrics, scenario results, scores, recommendation |
| **Leaves the browser** | Never | Yes, to our serverless function |
| **If it fails** | The customer is told and can retry | Nothing happens, and they never know |

The customer is never shown the spreadsheet, never told a row exists, and never
depends on it. Their PDF is built from the report already on screen, so it needs
no network and no credentials and cannot be affected by anything server-side.

## Storage today

```
AssessmentRepository (interface)
  ├── SpreadsheetRepository
  │     └── POST /api/assessments  ->  serverless function  ->  online sheet
  └── NoopRepository                   persistence off, and tests
```

The sheet is Google Sheets, which is Excel-compatible: it opens directly in
Excel and exports to .xlsx. It was chosen over a Microsoft Graph workbook on
practical grounds. A service account can be created and the sheet shared with it
in a few minutes, with no directory administrator and no admin consent, which
matters for a project a reviewer should be able to stand up themselves.

`recordMapper.ts` separates *flattening a report into a row* from *writing that
row*, so the same mapping serves a database or an API later without change.

### Why the browser holds nothing

The client posts a row and receives a status. It has no spreadsheet id, no
token, and no idea which provider is behind the endpoint. This is the point: a
credential that can write to the internal record must never be shipped to a
client, where any user could read it out of the bundle and write to the sheet
themselves.

### Failure is expected, not exceptional

`save()` returns `saved`, `not_configured` or `failed` rather than throwing, and
the UI ignores all three. The call is made after the report exists and is never
awaited.

Running with no spreadsheet configured is a supported deployment rather than a
broken one, which is why it has its own outcome instead of being reported as an
error. A reviewer who clones the project and opens it gets the full product;
only the row is missing.

### Validation before anything is written

The serverless function rejects a payload before it reaches the sheet when it:

- contains a field the record does not declare
- contains a field whose name looks like personal information
- carries an invalid recommendation, a malformed reference or timestamp, or a
  non-finite number

It also prefixes text beginning with `=`, `+`, `@` or `-`, which a spreadsheet
would otherwise evaluate as a formula.

This is a second line of defence rather than the first. The client never sends
such data, because the record type has no field for it. The validator means a
future change to the client cannot quietly start writing personal information
into the sheet.

## What production would require

A spreadsheet behind a service account is appropriate for a prototype and
inappropriate for real customer data at scale. A production deployment would
need:

- **Consent** — explicit, informed, before submission, with a clear statement of
  purpose and the ability to decline while still receiving the analysis.
- **Secure storage** — a managed database, encrypted at rest and in transit.
- **Access control** — least privilege, with access logged and reviewed.
- **Data minimisation** — the current no-PII position maintained deliberately
  rather than by accident.
- **Retention** — a defined period with automatic deletion, not indefinite
  accumulation.
- **POPIA alignment** — lawful basis, purpose limitation, an Information Officer,
  subject access and deletion rights, and breach notification.
- **A server-side engine** — so the calculation is auditable and cannot be
  tampered with client-side.
- **Rate limiting** — the collection endpoint is currently open, so a determined
  caller could fill the sheet with junk. Nothing sensitive leaks and the
  validator keeps the shape clean, but the storage is not protected from abuse.
- **Key rotation** — the service account key is a long-lived credential held in
  an environment variable, with no rotation schedule.
- **API key handling** — the AI call moves behind our own backend so no key ever
  reaches a browser.

The `AssessmentRepository` interface exists precisely so that this migration is a
new implementation rather than a rewrite.

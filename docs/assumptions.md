# Assumptions

Every assumed value, where it lives, why it has that value, and how much it
matters.

## Where they live

- **`src/config/assumptions.ts`** — everything we assume.
- **`src/config/transferDuty.ts`** — SARS transfer duty bands, kept separate
  because they are legislated rather than assumed, and change in the annual
  Budget. The yearly update is a one-file change.

Nothing financial is hard-coded anywhere else in the codebase. This is the point
of the file: a reviewer can audit every assumption in one place, and the customer
can be shown exactly what we assumed.

## Rates

| Assumption | Value | Reasoning |
|---|---|---|
| Default interest rate | 10.75% | Approximately prevailing prime. Used **only** when the customer says they don't know, and labelled as an assumption everywhere it appears. |
| Rate bounds | 1% – 35% | Validation guard. Wide enough for unusual arrangements, narrow enough to catch a mistyped figure. |
| Rental growth | 5%/yr | Broadly inflation. Rents track inflation over the long run more closely than property prices do. |
| Property growth | 5%/yr | Nominal, national average. Deliberately not optimistic — real SA house price growth has been near or below inflation for much of the past decade. |
| Investment return | 8%/yr | After-tax, on capital a renter keeps invested. Conservative for a balanced portfolio; see the note below on why it matters so much. |
| Inflation | 5%/yr | Applied to ownership running costs, which rise while the bond payment does not. |

### On the investment return

This is the most consequential and most contestable assumption in the model.

It exists because a renter who does not spend a deposit has that money working
elsewhere. Omitting this — as many calculators do — makes buying look better than
it is, by comparing a buyer's asset against a renter's nothing.

At 8% against 5% property growth, capital invested outside property compounds
faster than the property does. That is the single biggest reason short and medium
horizons often favour renting in this model, and customers who disagree with the
figure should be able to see that it is doing the work. It is listed in the
report's assumptions section for exactly that reason.

## Ownership running costs

| Assumption | Value | Reasoning |
|---|---|---|
| Maintenance | 1% of value/yr | Standard long-run rule of thumb. Lumpy in reality — nothing for years, then a roof. |
| Insurance | 0.4% of value/yr | Building cover, which bond providers require. |
| Rates and taxes | 0.8% of value/yr | Municipal rates. Varies substantially by municipality and valuation. |
| Levies | 0% | Defaults to freehold. Sectional title would add materially; see limitations. |

Together these add roughly 2.2% of property value per year — about R3,300/month
on a R1.8m property, or 22% on top of a typical bond payment. **This is the
correction that changes answers.** Customers comparing a bond quote with their
rent are routinely understating ownership by about a fifth.

## Transaction costs

| Assumption | Value | Reasoning |
|---|---|---|
| Transfer duty | SARS 2025/26 bands | Legislated. Nil below R1,210,000, rising to 13% on the portion above R13,310,000. |
| Conveyancing | 1.2% + R6,000 | Approximation of the stepped attorney tariff. |
| Bond registration | 1.3% of loan + R6,000 | Approximation. Zero for a cash purchase. |
| Deeds Office | R2,200 | Indicative. |
| Sundries | R3,500 | Searches, FICA, postage, petties. |
| Cost of selling | 6% of sale price | Mostly agent commission. |

Real attorney fees follow a stepped tariff rather than a smooth percentage. We
model proportional-plus-fixed, which tracks it closely enough to inform a
decision and is far easier to keep current. Every figure is labelled *estimated*
in the UI, and the report says an attorney will quote exactly.

On a R1.8m purchase these total roughly R80,000 — frequently the actual reason a
purchase is not yet affordable, and almost always more than customers expect.

## Resilience thresholds

Months of essential expenses plus debt covered by savings remaining after the
purchase:

| Band | Threshold |
|---|---|
| Strong | ≥ 6 months |
| Moderate | ≥ 3 months |
| Limited | ≥ 1 month |
| Very limited | < 1 month |

**There is no universally correct emergency fund.** Someone with secure
employment and family support needs less than a commission-only earner. These
bands *describe* a position rather than prescribing a target, the report says so,
and the values are configurable.

The engine treats below-1-month as blocking and below-3-months as straining. Those
are judgements about risk, not arithmetic, and they are stated as such.

## Affordability thresholds

| Assumption | Value | Reasoning |
|---|---|---|
| Comfortable housing ratio | 30% of take-home | Widely used guideline. |
| Stretched housing ratio | 40% of take-home | Beyond this, housing crowds out everything else. |
| Max total debt ratio | 45% of take-home | Roughly where SA lenders start declining. |

Note these are applied to **take-home** income, not gross. Guidelines quoted
against gross income are considerably less conservative than they appear.

## Scenario adjustments

Applied to the base assumptions, framed from the buyer's perspective:

| Scenario | Property growth | Rental growth | Investment return |
|---|---|---|---|
| Conservative | −2pp | −1pp | +2pp |
| Base | — | — | — |
| Optimistic | +2pp | +1pp | −2pp |

These three vary together because they are correlated in reality and because
varying them independently would produce a combinatorial spread that communicates
less, not more. Rates are floored at zero.

## Modelling choices that are not numbers

- **Expected stay** maps to a horizon: under 3 → 2 years, 3–5 → 4, 5–10 → 7,
  over 10 → 12. "Not sure" maps to 5 — a middling figure rather than a
  favourable one, and the report states that we assumed it.
- **Neutral band** — net advantages within 5% of the larger position are reported
  as neutral rather than a winner, since a gap that small is noise given input
  precision.
- **Decisive threshold** — a net advantage above 10% of property price cannot be
  overturned by personal preference in the decision engine.

## Updating these

The annual jobs:

1. **Transfer duty** after the February Budget — edit `transferDuty.ts`, update
   `TRANSFER_DUTY_TAX_YEAR`, and check the band-continuity test still passes.
2. **Default interest rate** when prime moves materially.
3. **Growth assumptions** if long-run expectations shift.

The band-continuity test is the safety net for (1): if the cumulative bases and
marginal rates are ever inconsistent, it fails immediately rather than silently
misquoting duty.

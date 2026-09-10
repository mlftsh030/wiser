# Decision engine

How a recommendation is reached, and why it is a hierarchy rather than a score.

## Why not a weighted score

The tempting design is:

```js
const score = 0.4*financial + 0.3*resilience + 0.2*outcome + 0.1*fit;
return score > 50 ? 'BUY' : 'RENT';
```

This is wrong, and not merely imprecise — it is wrong in a way that produces
harmful advice.

A weighted sum lets strength in one dimension compensate for failure in another.
But a customer who cannot cover the transfer costs cannot buy the house, no
matter how much they want to own or how favourable the ten-year projection looks.
Enthusiasm does not pay attorneys.

Some constraints are not factors. They are gates.

## The hierarchy

```
Stage 1: FINANCIAL SAFETY      → a gate. Fail it, the answer is RENT_FOR_NOW.
   ↓ (passed)
Stage 2: FINANCIAL COMPARISON  → sets the baseline answer.
   ↓
Stage 3: PERSONAL CIRCUMSTANCES → may move it one step, within limits.
```

### Stage 1 — Financial safety

Four checks, each producing a traceable reason and, where relevant, a risk:

| Check | Condition | Effect |
|---|---|---|
| Monthly affordability | `S_h < 0` | **Blocks** |
| Upfront feasibility | `S < DP + C` | **Blocks** |
| Emergency buffer | `B < 1 month` | **Blocks** |
| Emergency buffer | `B < 3 months` | Strains |
| Thin surplus | `S_h < 5% of income` | Strains |

*Blocked* means the recommendation is `RENT_FOR_NOW` regardless of Stage 2 and 3.

*Strained* is softer: the purchase is possible but uncomfortable. It caps the
result at `BUYING_MAY_WORK` — we will not call a purchase "attractive" when it
leaves a household without a cushion.

Stage 1 also notes separately when a customer's *current* rent and commitments
already exceed their income. That is a budget problem rather than a buying
problem, and it deserves saying on its own terms.

### Stage 2 — Financial comparison

Reads the base-scenario net advantage of buying and returns `favours_buying`,
`close`, or `favours_renting`, mapping to levels 2, 1 and 0.

It also reports whether the gap is **decisive** — more than 10% of the property
price. This distinction matters in Stage 3.

### Stage 3 — Personal circumstances

Can move the answer at most one step, and asymmetrically:

- **Toward renting**: always allowed. A short expected stay or high likelihood of
  moving reduces the answer, because these are genuine financial facts about
  transaction costs, not merely preferences.
- **Toward buying**: only when the comparison is *not decisive* **and** does not
  already favour renting.

That second rule was added after a real defect. An earlier version let a strong
personal-fit score promote a case where the base comparison favoured renting,
producing this on screen:

```
Buying may work
Recommendation robustness: 1 / 3 scenarios support this result
```

The report contradicted itself in front of the customer. Preference may break a
tie; it cannot overturn the numbers. A coherence test suite across eight customer
profiles now makes that combination impossible.

## Outcomes

| Recommendation | Meaning |
|---|---|
| `BUYING_LOOKS_ATTRACTIVE` | Safe, and the economics clearly favour it |
| `BUYING_MAY_WORK` | Possible, but close, strained, or assumption-dependent |
| `RENT_FOR_NOW` | Not safe, or the economics favour renting |

"For now" is deliberate. It frames the position as changeable, which it usually
is, and points the customer at the levers.

## The explainable decision object

The engine never returns a string. It returns:

```ts
{
  recommendation, headline, summary,
  reasons: [{ category, statement, impact, weight }],
  risks:   [{ statement, severity }],
  whatCouldChange: [{ statement, category }],
  robustness: { supporting, total, sensitive },
  strongestFactor, biggestRisk,
}
```

`weight` ranks reasons so the report leads with what actually mattered — a
blocking affordability failure (weight 100) outranks a general observation about
horizon (78). A test asserts the returned array is sorted.

The UI renders this structure and composes no reasoning of its own. That
separation is what makes the engine reusable by a different interface, an API, or
a batch job over the dataset.

## Robustness

```
Robustness = scenarios supporting the recommendation / total scenarios
```

A scenario "supports" a recommendation when it does not point away from it. For
the hedged `BUYING_MAY_WORK`, a close-to-even scenario counts but a clearly
rent-favouring one does not.

`sensitive` is true when the scenarios genuinely disagree in direction — at least
one favours buying and at least one favours renting. When true, an explicit risk
is added telling the customer the result depends on market assumptions.

This is deliberately **not** called statistical confidence, and the UI says so in
as many words. It measures sensitivity to our own assumptions. It is not a
probability, and three scenarios do not bound what the future can do.

## What could change the result

Every result includes calculated levers. None are invented:

- **Savings target** — the actual rand amount needed to reach a 3-month buffer.
- **Affordable price** — solved directly by inverting the ownership-cost
  relationship, rounded down to the nearest R50,000 to avoid implying precision
  the model does not have.
- **Rate sensitivity** — the real monthly effect of a one-percentage-point move,
  computed by re-running the annuity formula.
- **Time** — how the comparison shifts with a longer horizon.

This section is what turns a verdict into something a customer can act on.

# Financial model

Every formula, why it is there, and what it deliberately ignores.

## Notation

| Symbol | Meaning |
|---|---|
| `I` | Monthly take-home household income |
| `E` | Essential monthly expenses |
| `D` | Existing monthly debt repayments |
| `S` | Accessible savings |
| `DP` | Upfront contribution (deposit) |
| `C` | Estimated transaction costs |
| `P` | Property price |
| `L` | Loan amount, `P − DP` |
| `H` | Full monthly cost of ownership |
| `T` | Loan term in years |
| `r` | Nominal annual interest rate |

## Financial capacity

```
S_m = I − E − D          Surplus before housing
S_h = I − E − D − H      Surplus after housing
```

We use **take-home** rather than gross income because affordability is about
cash that actually reaches the household. We measure against **essential**
expenses because discretionary spending can flex under pressure and rates,
groceries and school fees cannot.

`S_h < 0` means the purchase cannot be sustained from income. The decision
engine treats this as a hard constraint, not a low score — see
[decision-engine.md](decision-engine.md).

## Bond repayment

A South African bond is a standard amortising loan with monthly compounding, so
the ordinary annuity formula applies:

```
        i(1 + i)^n
M = L · ──────────        where i = r/12,  n = 12T
       (1 + i)^n − 1
```

This is identical to Excel's `PMT`. Verified against known values: R1,000,000 at
10.75% over 20 years gives R10,152.29/month.

**The zero-rate branch is not a curiosity.** The denominator `(1+i)^n − 1` is
zero when `i` is zero, so an interest-free loan produces `NaN` and silently
poisons every downstream figure. It is handled explicitly and tested.

### Outstanding balance

Needed for equity at the end of the holding period. Derived in closed form
rather than by iterating an amortisation table, so projections stay cheap:

```
B(m) = L(1 + i)^m − M · ((1 + i)^m − 1) / i
```

Tested to return exactly `L` at `m = 0` and exactly `0` at `m = n`. This also
captures something customers consistently underestimate: after five years of a
twenty-year bond, more than 88% of the principal is still outstanding. Early
repayments are mostly interest, which is a large part of why short holding
periods favour renting.

## Cost of ownership

```
H = M + rates + insurance + maintenance + levies
```

Running costs are modelled as annual percentages of property value, converted to
monthly. This is the correction that matters most in this whole model:
**comparing a bond repayment with rent is the single most common mistake in this
decision.** Rates, insurance and maintenance are real, recurring, and fall on the
owner alone. On a R1.8m property they add roughly R3,300/month — about 22% on top
of the bond.

In projections the bond payment stays fixed while running costs inflate, since
that is how they actually behave.

## Transaction costs

### Transfer duty

SARS bands, applied marginally: duty on the portion of the price in each band,
plus the cumulative duty on all bands below. Isolated in `config/transferDuty.ts`
because the rates are legislated and revised each Budget.

A test asserts **continuity at every band boundary** — that duty at the top of a
band equals the base of the next. A discontinuity would mean a customer paying a
cliff-edge jump for one extra rand of price, which is the signature of a
miskeyed table.

### Other purchase costs

Conveyancing, bond registration, Deeds Office fees and disbursements. Real
attorney fees follow a stepped tariff; we approximate with
proportional-plus-fixed, which tracks it closely enough for decision support and
is far easier to keep current. Everything is labelled *estimated* in the UI.

Together these land at roughly 4–5% of the purchase price — typically R80,000+ on
a R1.8m home, and often the real reason a purchase is not yet affordable.

### Selling costs

6% of the eventual sale price, mostly agent commission. Deducted from equity in
the comparison. This is a large part of why a short stay works against buying.

## Financial resilience

```
S_R = S − DP − C          Savings remaining after the purchase
B   = S_R / (E + D)       Buffer, in months of commitments
```

Measured against essentials plus debt rather than income, because in a crisis
the question is how long the household can meet unavoidable commitments.

Bands: **strong** ≥ 6 months, **moderate** ≥ 3, **limited** ≥ 1, **very limited**
below that. There is no universally correct emergency fund, so these describe
rather than prescribe, and the thresholds are configurable.

Where commitments are zero the buffer is capped at 99 rather than returning
`Infinity` — tested.

## Buy vs rent

The honest comparison is not "bond vs rent" but two complete strategies compared
by **end-state net worth**.

**Buying:** spend `DP + C` today, pay `H` monthly, end holding
`V_T − B(T) − selling costs`.

**Renting:** keep `DP + C` invested, pay rent monthly, and invest the monthly
difference between renting and owning.

Projections:

```
Rent_t = R_0 (1 + g)^t         g = rental growth
V_T    = P (1 + a)^T           a = property appreciation
E_T    = V_T − B(T) − selling costs
```

The renter's pot each month:

```
K_{m+1} = K_m (1 + ρ) + (own_m − rent_m)
```

where `ρ` is the monthly investment return. Note the term is signed: when owning
costs more, the renter invests the difference; when renting costs more, they draw
down. Modelling both directions is what keeps it fair.

```
Net advantage of buying = E_T − K_T
```

**Crediting the renter with investment growth on capital they did not spend is
essential.** Omitting it is the standard way calculators reach a foregone
conclusion. A test asserts the property directly: after even one year, the
renter's pot must exceed the cash the buyer laid out.

Differences within 5% of the larger position are reported as *neutral* rather
than a winner, since a gap that small is noise given the precision of the inputs.

## What the model ignores

Stated plainly, because a model whose simplifications are hidden cannot be
trusted:

- **Capital gains tax** on sale, and the primary-residence exclusion.
- **Tax on investment returns** — the renter's growth is modelled after-tax via
  a conservative 8% assumption rather than explicitly.
- **Rental deposits and moving costs**, small but real on the renting side.
- **Access bonds and extra repayments**, which materially change interest paid.
- **Variable rates over time** — the rate is held constant, with sensitivity
  shown separately as the monthly effect of a one-percentage-point move.
- **Regional variation** — one national growth assumption everywhere.
- **Body corporate special levies**, sectional-title reserve funds.
- **Rental voids or bad tenants** — not relevant to an owner-occupier.

The scenario range is the honest response to several of these: rather than
claiming precision, we show how much the answer moves when the assumptions do.

# Product thinking

Why this is a decision-support journey rather than a classifier.

## The question behind the question

"Should I buy or rent?" is not really a request for an answer. Almost nobody
asks it expecting to be told what to do by a website. What they are actually
asking is closer to:

> *Am I in a position to do this? What would it cost me? What am I not seeing?*

A tool that returns `BUY` answers none of that. Worse, it answers with a
confidence it has not earned, because the honest answer depends on things the
customer knows and the model does not — whether their job is stable, whether
they might emigrate, whether their parents can help.

So the design goal was not accuracy of verdict. It was **making the customer
better informed than when they arrived**.

## Why a verdict would be wrong here

There is no single correct answer to this question, and this is not a
philosophical point — it falls directly out of the model.

Two customers with *identical* finances should receive different answers if one
expects to stay two years and the other twelve, because transaction costs of
roughly 5% on purchase and 6% on sale need time to be recovered. Two customers
with identical finances *and* identical horizons should still weigh the answer
differently if one values flexibility above all and the other wants somewhere
permanent for their children.

Any system that collapses this to a binary is throwing away the information that
makes the answer correct.

## What we do instead

The journey mirrors how a good adviser would actually work through it:

```
Where are you today?     → income, commitments, savings
What are you considering? → the property, what you'd put in
How would you finance it? → rate, term
How long will you stay?   → the single most decisive input
What matters to you?      → because the money is not the whole answer
```

Each question is accompanied by *why we are asking*. This is not decoration. A
customer who understands why we want their essential expenses gives a better
answer than one who suspects we are being nosy — and a customer who understands
the question is better placed to disagree with our conclusion.

## Designing for disagreement

The most important design principle here: **the customer should be able to argue
with the result.**

That drove several concrete decisions:

- Every recommendation carries its reasoning, tagged by category and impact,
  rather than a summary paragraph.
- Every assumption is listed with its value and a plain explanation.
- The result explicitly names what would change it.
- Where we assumed something (an unknown interest rate, an uncertain horizon)
  the report says so at the point where it matters.

If a customer reads the report and thinks "you assumed 5% property growth and I
think that's optimistic for my area" — that is a success. They now understand
the decision better than a verdict would have left them.

## Progressive disclosure

Fifteen questions on one page reads as a form to be endured. One coherent group
per page reads as a conversation.

The same principle governs the report. It opens with the recommendation, the
single strongest factor and the single biggest risk. Detail is layered beneath —
the full reasoning, then the position, then the comparison, then scenarios, then
levers, then assumptions. Cost breakdowns sit inside collapsed sections for the
customers who want them.

Someone who reads only the first screen gets a genuinely useful answer. Someone
who reads everything gets the full analysis. Neither is punished.

## Language

The tone target was "a competent friend who happens to know about money".

We write "Buying could work financially, but it would leave you with less cash
available for emergencies", not "Your financial circumstances indicate a
suboptimal capital allocation strategy".

Specific rules applied throughout:

- Never "you should". Always "based on the assumptions you provided".
- Name the trade-off rather than hiding it behind a score.
- Give real numbers in sentences, because "about R80,000 more in savings" is
  actionable and "improve your resilience" is not.
- Say "estimated" wherever a figure is estimated.
- Never promise or guarantee an outcome.

A test enforces the first of these: the headline and summary are checked against
a list of prescriptive phrases across several customer profiles.

## What we deliberately did not build

- **A dashboard.** Ten charts would communicate less than four scores and a
  clear sentence. Two visuals earn their place: the buy-vs-rent table and the
  scenario range.
- **A lead-capture form.** We ask for no name, email or phone number. Nothing in
  the analysis needs them. This is also why the customer's report is a download
  rather than something we email them: emailing it would require an address, and
  an address is the first piece of personal information we would have to justify
  holding.
- **A spreadsheet for the customer.** The customer's record is a PDF, because
  they need to read and discuss it, not analyse it. A flat row of columns is the
  right shape for us and the wrong shape for them. The internal record still
  exists, but it is ours and they never see it.
- **An AI adviser.** The AI rewrites conclusions the deterministic engine has
  already reached. Letting a language model reason about someone's finances
  directly would be the wrong tool for a decision of this size.
- **Precision we don't have.** Affordable-price suggestions round to the nearest
  R50,000, because implying more accuracy than the model supports is its own
  kind of dishonesty.

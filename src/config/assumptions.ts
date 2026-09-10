/**
 * Central assumptions configuration.
 *
 * Every number the model assumes on the customer's behalf lives here. This
 * exists so that (a) a reviewer can audit our assumptions in one place, and
 * (b) the customer can be shown exactly what we assumed. Scattering these
 * values through the calculation modules would make both impossible.
 *
 * Figures are indicative South African market values as at 2025/26. They are
 * decision-support assumptions, not quotes or guarantees.
 */

export interface RateAssumptions {
  /** Nominal annual interest rate used when the customer does not know theirs. */
  defaultInterestRate: number;
  /** Bounds for customer-supplied rates. Outside this we treat input as an error. */
  minInterestRate: number;
  maxInterestRate: number;
  /** Annual growth in residential rent. */
  rentalGrowth: number;
  /** Annual nominal residential property appreciation. */
  propertyGrowth: number;
  /**
   * Annual after-tax return assumed on capital a renter keeps invested.
   * Including this is what stops the model from flattering ownership: a renter
   * who does not spend a deposit has that money working elsewhere.
   */
  investmentReturn: number;
  /** General price inflation, applied to ownership running costs. */
  inflation: number;
}

export interface OwnershipCostAssumptions {
  /** Annual maintenance as a share of property value. */
  maintenanceRate: number;
  /** Annual building insurance as a share of property value. */
  insuranceRate: number;
  /** Annual municipal rates as a share of property value. */
  ratesAndTaxesRate: number;
  /** Monthly levies as a share of property value per year (0 for freehold). */
  leviesRate: number;
}

export interface TransactionCostAssumptions {
  /** Estimated agent commission on sale, as a share of sale price. */
  sellingCostRate: number;
  /** Bond registration cost as a share of the loan, plus a fixed component. */
  bondRegistrationRate: number;
  bondRegistrationFixed: number;
  /** Conveyancing/transfer attorney cost as a share of price, plus fixed. */
  conveyancingRate: number;
  conveyancingFixed: number;
  /** Deeds Office and sundry disbursements. */
  deedsOfficeFee: number;
  sundryCosts: number;
}

/**
 * Buffer thresholds, expressed in months of essential expenses + debt.
 *
 * There is no universally correct emergency fund. These are the bands we use
 * to *describe* resilience, and we say so in the report rather than presenting
 * them as a rule.
 */
export interface ResilienceThresholds {
  strong: number;
  moderate: number;
  limited: number;
}

/** Share of surplus income a housing payment may consume before we flag strain. */
export interface AffordabilityThresholds {
  /** Housing cost as a share of take-home income - comfortable ceiling. */
  comfortableHousingRatio: number;
  /** Housing cost as a share of take-home income - stretched ceiling. */
  stretchedHousingRatio: number;
  /** Total debt service (housing + existing debt) share of income lenders watch. */
  maxTotalDebtRatio: number;
}

export interface Assumptions {
  rates: RateAssumptions;
  ownership: OwnershipCostAssumptions;
  transaction: TransactionCostAssumptions;
  resilience: ResilienceThresholds;
  affordability: AffordabilityThresholds;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  rates: {
    defaultInterestRate: 0.1075,
    minInterestRate: 0.01,
    maxInterestRate: 0.35,
    rentalGrowth: 0.05,
    propertyGrowth: 0.05,
    investmentReturn: 0.08,
    inflation: 0.05,
  },
  ownership: {
    maintenanceRate: 0.01,
    insuranceRate: 0.004,
    ratesAndTaxesRate: 0.008,
    leviesRate: 0,
  },
  transaction: {
    sellingCostRate: 0.06,
    bondRegistrationRate: 0.013,
    bondRegistrationFixed: 6000,
    conveyancingRate: 0.012,
    conveyancingFixed: 6000,
    deedsOfficeFee: 2200,
    sundryCosts: 3500,
  },
  resilience: {
    strong: 6,
    moderate: 3,
    limited: 1,
  },
  affordability: {
    comfortableHousingRatio: 0.3,
    stretchedHousingRatio: 0.4,
    maxTotalDebtRatio: 0.45,
  },
};

/**
 * Human-readable descriptions of each assumption, shown in the report's
 * assumptions section. Kept alongside the values so the two cannot drift.
 */
export const ASSUMPTION_NOTES: ReadonlyArray<{
  label: string;
  value: (a: Assumptions) => string;
  note: string;
}> = [
  {
    label: 'Default interest rate',
    value: (a) => formatPercent(a.rates.defaultInterestRate),
    note: 'Used only when you tell us you do not know your rate. Roughly the prevailing prime lending rate.',
  },
  {
    label: 'Rental growth',
    value: (a) => formatPercent(a.rates.rentalGrowth) + ' a year',
    note: 'Rent is assumed to rise broadly in line with inflation.',
  },
  {
    label: 'Property growth',
    value: (a) => formatPercent(a.rates.propertyGrowth) + ' a year',
    note: 'A nominal, national-average assumption. Actual growth varies enormously by area and is not predictable.',
  },
  {
    label: 'Return on money not spent on a house',
    value: (a) => formatPercent(a.rates.investmentReturn) + ' a year',
    note: 'If you rent, your deposit and purchase costs stay invested. We credit renting with that growth.',
  },
  {
    label: 'Maintenance',
    value: (a) => formatPercent(a.ownership.maintenanceRate) + ' of property value a year',
    note: 'Owners carry repairs that a tenant would not. This is a long-run average, not a monthly bill.',
  },
  {
    label: 'Building insurance',
    value: (a) => formatPercent(a.ownership.insuranceRate) + ' of property value a year',
    note: 'Bond providers require building cover.',
  },
  {
    label: 'Rates and taxes',
    value: (a) => formatPercent(a.ownership.ratesAndTaxesRate) + ' of property value a year',
    note: 'Municipal rates. Varies by municipality and valuation.',
  },
  {
    label: 'Cost of selling',
    value: (a) => formatPercent(a.transaction.sellingCostRate) + ' of the sale price',
    note: 'Mostly agent commission. This is why a short stay works against buying.',
  },
];

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

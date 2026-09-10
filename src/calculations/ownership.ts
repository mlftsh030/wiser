/**
 * Recurring monthly cost of owning.
 *
 *   H = M + Rt + In + Ma + Lv
 *
 * Comparing a bond repayment with rent is the single most common mistake in
 * this decision. Rates, insurance and maintenance are real, recurring, and
 * fall on the owner alone, so they belong in H.
 */

import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../config/assumptions';
import type { OwnershipCosts } from '../models/results';

export function calculateOwnershipCosts(
  propertyPrice: number,
  monthlyMortgage: number,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): OwnershipCosts {
  const o = assumptions.ownership;
  const price = Math.max(propertyPrice, 0);

  // Annual rates expressed against property value, converted to monthly.
  const ratesAndTaxes = (price * o.ratesAndTaxesRate) / 12;
  const insurance = (price * o.insuranceRate) / 12;
  const maintenance = (price * o.maintenanceRate) / 12;
  const levies = (price * o.leviesRate) / 12;
  const mortgage = Math.max(monthlyMortgage, 0);

  return {
    mortgage,
    ratesAndTaxes,
    insurance,
    maintenance,
    levies,
    total: mortgage + ratesAndTaxes + insurance + maintenance + levies,
  };
}

/**
 * Ownership running costs excluding the bond, grown by inflation.
 * Used in projections: unlike the bond payment, these costs rise over time.
 */
export function runningCostsInYear(
  propertyPrice: number,
  year: number,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): number {
  const o = assumptions.ownership;
  const annualRate = o.ratesAndTaxesRate + o.insuranceRate + o.maintenanceRate + o.leviesRate;
  const base = (Math.max(propertyPrice, 0) * annualRate) / 12;
  return base * Math.pow(1 + assumptions.rates.inflation, year);
}

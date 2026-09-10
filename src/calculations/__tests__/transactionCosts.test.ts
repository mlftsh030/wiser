import { describe, expect, it } from 'vitest';
import {
  calculateSellingCosts,
  calculateTransactionCosts,
  calculateTransferDuty,
} from '../transactionCosts';
import { TRANSFER_DUTY_BANDS } from '../../config/transferDuty';

describe('calculateTransferDuty', () => {
  it('charges nothing below the SARS threshold', () => {
    expect(calculateTransferDuty(900_000)).toBe(0);
    expect(calculateTransferDuty(1_210_000)).toBe(0);
  });

  it('charges 3% on the portion above the threshold', () => {
    // R1.5m: (1_500_000 - 1_210_000) * 3% = 8_700
    expect(calculateTransferDuty(1_500_000)).toBeCloseTo(8_700, 2);
  });

  it('applies the cumulative base plus the marginal rate in higher bands', () => {
    // R3m sits in the 11% band: 106_784 + (3_000_000 - 2_994_800) * 11%
    expect(calculateTransferDuty(3_000_000)).toBeCloseTo(107_356, 2);
  });

  it('handles the top open-ended band', () => {
    // R15m: 1_241_456 + (15_000_000 - 13_310_000) * 13%
    expect(calculateTransferDuty(15_000_000)).toBeCloseTo(1_461_156, 2);
  });

  it('is continuous across every band boundary', () => {
    // A discontinuity here would mean a customer pays a cliff-edge jump in
    // duty for one extra rand of price - a sure sign the table is miskeyed.
    for (const band of TRANSFER_DUTY_BANDS) {
      if (band.to === null) continue;
      expect(calculateTransferDuty(band.to)).toBeCloseTo(calculateTransferDuty(band.to + 1), 0);
    }
  });

  it('increases monotonically with price', () => {
    let previous = -1;
    for (let price = 500_000; price <= 20_000_000; price += 250_000) {
      const duty = calculateTransferDuty(price);
      expect(duty).toBeGreaterThanOrEqual(previous);
      previous = duty;
    }
  });

  it('returns zero for a zero or negative price', () => {
    expect(calculateTransferDuty(0)).toBe(0);
    expect(calculateTransferDuty(-100)).toBe(0);
  });
});

describe('calculateTransactionCosts', () => {
  it('omits bond registration for a cash buyer', () => {
    const costs = calculateTransactionCosts(1_500_000, 0);
    expect(costs.bondRegistration).toBe(0);
    expect(costs.total).toBeGreaterThan(0);
  });

  it('includes bond registration when there is a loan', () => {
    const withBond = calculateTransactionCosts(1_500_000, 1_200_000);
    const cash = calculateTransactionCosts(1_500_000, 0);
    expect(withBond.bondRegistration).toBeGreaterThan(0);
    expect(withBond.total).toBeGreaterThan(cash.total);
  });

  it('sums its components exactly', () => {
    const c = calculateTransactionCosts(2_000_000, 1_600_000);
    expect(c.total).toBeCloseTo(
      c.transferDuty + c.conveyancing + c.bondRegistration + c.deedsOffice + c.sundries,
      6,
    );
  });

  it('is a material share of the price - the point of modelling it', () => {
    // On a R2m purchase, costs should land in the plausible 3-8% range.
    const c = calculateTransactionCosts(2_000_000, 1_600_000);
    expect(c.total / 2_000_000).toBeGreaterThan(0.03);
    expect(c.total / 2_000_000).toBeLessThan(0.08);
  });

  it('returns an empty breakdown for a zero price', () => {
    expect(calculateTransactionCosts(0, 0).total).toBe(0);
  });
});

describe('calculateSellingCosts', () => {
  it('applies the commission rate to the sale price', () => {
    expect(calculateSellingCosts(2_000_000)).toBeCloseTo(120_000, 2);
  });

  it('never returns a negative cost', () => {
    expect(calculateSellingCosts(-500_000)).toBe(0);
  });
});

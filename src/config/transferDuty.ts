/**
 * SARS transfer duty bands.
 *
 * Legislated rates, kept separate from DEFAULT_ASSUMPTIONS because these are
 * not our assumptions - they are law, and they are revised in the annual
 * Budget. Isolating them means the yearly update is a one-file change.
 *
 * Source: SARS transfer duty tables, 2025/26 tax year (from 1 March 2025).
 * Applies to natural persons and legal entities alike.
 */

export interface TransferDutyBand {
  /** Lower bound of the band, exclusive of the threshold below it. */
  from: number;
  /** Upper bound, or null for the top open-ended band. */
  to: number | null;
  /** Marginal rate applied to the portion of the price within this band. */
  rate: number;
  /** Cumulative duty payable on all bands below this one. */
  base: number;
}

export const TRANSFER_DUTY_TAX_YEAR = '2025/26';

export const TRANSFER_DUTY_BANDS: ReadonlyArray<TransferDutyBand> = [
  { from: 0, to: 1_210_000, rate: 0, base: 0 },
  { from: 1_210_000, to: 1_663_800, rate: 0.03, base: 0 },
  { from: 1_663_800, to: 2_329_300, rate: 0.06, base: 13_614 },
  { from: 2_329_300, to: 2_994_800, rate: 0.08, base: 53_544 },
  { from: 2_994_800, to: 13_310_000, rate: 0.11, base: 106_784 },
  { from: 13_310_000, to: null, rate: 0.13, base: 1_241_456 },
];

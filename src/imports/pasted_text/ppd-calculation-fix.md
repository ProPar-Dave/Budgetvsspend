CONSOLIDATED FIX — PPD calculation across all pivots and drill levels.

This fix aligns the PPD implementation with the PPD doctrine:
  PPD = Total amount in period ÷ Total patient-days in period
  Where patient-days = SUM of daily census across the selected timeframe

There are FIVE bugs to fix in a single pass. They all stem from the same general problem: the census query is either running with the wrong scope or not running at all for the current view. The root cause is #1; fixes #2-5 depend on #1 being correct.

═══════════════════════════════════════
BUG #1 (ROOT CAUSE) — Census SUM is not filtered to the selected timeframe
═══════════════════════════════════════

Every SUM(value) FROM bvs.census_daily query in the edge function MUST include:
  WHERE effective_date >= [timeframe_start]
    AND effective_date <= [timeframe_end]

Currently the query is summing person-days across the ENTIRE census_daily table (28 months of data) regardless of the selected Timeframe. The result is a denominator that is roughly 28× larger than it should be.

For MTD Apr 1-15 2026:
  Correct portfolio person-days ≈ 120,412
  Currently returning: 2,928,811 (28× too high)

For Alderwood Apr 1-15 2026:
  Correct facility person-days ≈ 948
  Currently returning: 23,588 (25× too high)

Apply the timeframe WHERE clause to every census SUM query at every drill level.

═══════════════════════════════════════
BUG #2 — Row-level PPD uses per-facility denominators instead of shared denominator
═══════════════════════════════════════

In the Facility pivot (portfolio view), each row currently uses its OWN full-history person-days as denominator. Alderwood uses 23,588, Buttonwood uses 28,241, Cottonwood uses 18,866 — different denominators mean the PPD values are not comparable across rows. This violates doctrine: PPD exists to enable apples-to-apples comparison between facilities.

When BUG #1 is fixed (timeframe-scoped queries), each facility's PPD will use its own TIMEFRAME-scoped person-days:
  Alderwood row PPD = Alderwood spend ÷ Alderwood person-days for selected timeframe
  Buttonwood row PPD = Buttonwood spend ÷ Buttonwood person-days for selected timeframe

This is actually the doctrine-correct approach for facility rows because different facilities have different census sizes — "PPD normalizes for occupancy" means each facility's own census is its denominator. So #2 is resolved automatically by #1.

The portfolio KPI uses aggregate: SUM(all facility spend) ÷ SUM(all facility person-days for timeframe).

═══════════════════════════════════════
BUG #3 — GL pivot shows "--" for all PPD values
═══════════════════════════════════════

Per doctrine, category-level PPD (Dietary PPD, Pharmacy PPD, Housekeeping PPD, etc.) is the PRIMARY management lens. The GL pivot is where an operator would spot that their dietary PPD is above peer benchmarks.

Currently the GL × PPD view returns null for all PPD fields.

Fix — for the GL pivot in PPD mode:
  Portfolio-level KPI: same as Facility pivot KPI
    = SUM(all spend) ÷ SUM(all person-days for timeframe)

  Each GL row:
    GL PPD = SUM(spend for this GL across all facilities, for timeframe)
             ÷ SUM(all person-days for timeframe)
    Using the SAME portfolio-wide person-days denominator across all GL rows.
    This is required by doctrine — every category PPD divides by the same patient-days,
    so operators can see "dietary is $83 PPD, pharmacy is $45 PPD" and they add up to total.

  Budget PPD per GL = SUM(budget for this GL across portfolio) ÷ SUM(all person-days)
  Variance PPD = Budget PPD - Spend PPD
  Variance % = (Budget PPD - Spend PPD) / Budget PPD × 100
  Status from variance % using ±5% bands

═══════════════════════════════════════
BUG #4 — Vendor pivot × PPD shows $0.00
═══════════════════════════════════════

The doctrine does not explicitly list vendor-level PPD as a canonical metric. Vendors are transaction sources, not care cost categories. Two acceptable approaches:

Option A (RECOMMENDED — doctrine-agnostic, useful): Show vendor PPD using portfolio denominator.
  Each vendor row shows: vendor spend ÷ portfolio person-days
  This tells the operator "McKesson costs us $4.20 per patient-day across the portfolio"
  KPI Total Spend PPD = same portfolio PPD as Facility pivot
  Same denominator as GL pivot — a top-20 vendor's PPD can be summed with others to reconcile.

Option B (if Option A is not desired): Disable PPD mode for Vendor pivot.
  When Pivot By = Vendor AND Metric = PPD, show a banner:
    "Per-vendor PPD is not a standard metric. Switch to Dollars mode for vendor analysis."
  Keep the PPD dropdown available but disable the calculation.

Choose Option A. It's more useful and costs less to implement since the math is the same pattern as the GL pivot (category-level PPD with shared portfolio denominator).

═══════════════════════════════════════
BUG #5 — Vendor pivot columns don't adapt to PPD mode
═══════════════════════════════════════

Currently in Vendor × PPD mode, the "Avg Transaction" column still shows dollar values ($958, $1.17K, etc.) which are nonsensical when Metric = PPD. Dollar-per-transaction doesn't translate to per-patient-day.

Fix:
  When Metric = PPD, the Vendor pivot should show these columns:
    - Vendor name
    - Spend PPD (vendor spend ÷ portfolio person-days)
    - Txn Count (same, unit-independent)
    - Trend (sparkline of monthly spend, same as dollars mode)
  Hide or replace "Avg Transaction" and "Last Transaction" in PPD mode, OR keep them with original dollar/date values clearly labeled as context (not subject to PPD conversion).

═══════════════════════════════════════
VERIFICATION CHECKLIST
═══════════════════════════════════════

After fix, all of these must be true for MTD Apr 1-15 2026 in PPD mode:

Facility pivot (portfolio):
  ✓ KPI "Based on ~120,000 person-days" (not 2.9M)
  ✓ Portfolio Spend PPD ≈ $211 (realistic blended post-acute PPD)
  ✓ Alderwood row shows Spend PPD ≈ $181 (≈ $171,920 ÷ 948)
  ✓ Different facilities show different PPD values (each using own timeframe-scoped census)

Facility drill-in (e.g. Alderwood):
  ✓ KPI "Based on ~948 person-days" (not 23,588)
  ✓ Drill-in KPI Spend PPD ≈ $181 (matches row value from parent)
  ✓ Each GL row PPD = GL spend for this facility ÷ 948

GL pivot (portfolio):
  ✓ KPI Spend PPD ≈ $211 (same as Facility pivot portfolio KPI — same SUM/SUM)
  ✓ Each GL row shows a NON-NULL PPD value
  ✓ Food Products (6100) row PPD ≈ (its portfolio spend) ÷ 120,412
  ✓ Sum of all GL PPDs (across active, non-excluded) ≈ portfolio KPI PPD

Vendor pivot (portfolio):
  ✓ KPI Spend PPD ≈ $211 (same SUM/SUM)
  ✓ Each vendor row shows a non-zero PPD value
  ✓ Avg Transaction column either hidden or clearly labeled as dollar context
  ✓ OR if Option B chosen, banner explaining PPD disabled for vendor pivot

Cross-pivot consistency:
  ✓ Portfolio KPI Spend PPD IDENTICAL across Facility / GL / Vendor pivots (~$211)
  ✓ This is the doctrine test — same timeframe, same spend total, same denominator
  ✓ If values differ between pivots, the aggregation is broken

═══════════════════════════════════════
IMPORTANT NOTE ON VALUE MAGNITUDE
═══════════════════════════════════════

After the fix, PPD values will look different from what's currently displayed:
  - Portfolio Spend PPD will go from $193 → ~$211 (small change — by coincidence the old wrong number was close to the right one)
  - Alderwood facility drill-in PPD will go from $157 → ~$181
  - GL-level PPDs will appear where previously "--" was shown
  - Vendor-level PPDs will appear where previously $0.00 was shown

Individual GL PPD values may be higher than industry benchmarks (e.g. Food cost PPD might show $83 instead of the doctrine's cited $5-$7 range). This reflects the CURRENT SEED DATA being unrealistic — the reseed migration (separate workstream) corrects the seed distribution. Do NOT try to "fix" these values by tweaking the calculation. The formula is correct. The seed is what will change.
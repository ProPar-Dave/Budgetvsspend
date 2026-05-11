CRITICAL BUG — PPD is broken at multiple drill-down levels with DIFFERENT failure modes at each level. This needs a unified fix across the edge function PPD code paths.

OBSERVED BEHAVIOR (Apr 1–15 MTD in PPD mode):

Level 1 — Portfolio (home view):
  KPI: $176.44 / $193.70 (WRONG — ~23-28× too low)
  Rows: Alderwood $136.96 / $157.57 (WRONG — same ratio)
  "Based on 2,928,811 person-days" (WRONG — expected ~105,000)

Level 2 — Facility drill-in (click Alderwood):
  KPI: $0.00 / $0.00 / $0.00
  Rows (GLs): ALL show "--" for Budget/Spend/Variance PPD
  % column still populated, Status still populated

Level 3 — GL drill-in (click a GL):
  KPI: $0.00 / $0.00 / $0.00 (shown as "Total Spend", "Vendor Count", "Avg Spend/Vendor" — PPD context lost)
  Rows (vendors): ALL show $0.00 for Total Spend
  PLUS: All vendor rows still appear under "EXCLUDED ITEMS" header with muted styling

ROOT CAUSE ANALYSIS:

The edge function has multiple PPD query paths — each level (portfolio / facility drill-in / GL drill-in) has its own backend query. Each has a different bug:

  PATH A (Portfolio + facility rows): Working but WRONG DENOMINATOR
    - The census SUM query is running, but NOT filtered to the selected timeframe
    - It's summing person-days across the ENTIRE census_daily table (28 months of data)
    - Math proof: 2,928,811 total / 105,000 expected = 27.9 ≈ 28 months in the table
    - Same ratio at row level: Alderwood denominator 23,584 vs expected 1,020 = 23×

  PATH B (Facility drill-in KPI + GL rows): COMPLETELY BROKEN
    - Returns null/0 for all PPD values
    - Triggers the zero-denominator guard so all values display as "--"
    - Likely: the GL-level PPD query either doesn't exist or has a fatal SQL error

  PATH C (GL drill-in / vendor view): PPD SHOULDN'T APPLY
    - Vendors are not associated with census (census is facility-level)
    - PPD at vendor grain is not a valid metric
    - Currently showing $0.00 instead of handling gracefully
    - Also: F3 bug — all vendor rows show under "EXCLUDED ITEMS" header with muted styling

REQUIRED FIXES:

FIX 1 — Apply timeframe filter to ALL census SUM queries:
The WHERE clause for ANY SUM(value) FROM bvs.census_daily query must include:
  WHERE effective_date >= [timeframe_start] AND effective_date <= [timeframe_end]

Verify this is present at BOTH:
  - Portfolio KPI person-days calculation
  - Per-facility person-days calculation (used for facility row PPD)
  - Per-facility person-days calculation (used for facility drill-in KPI)
  - Per-facility person-days calculation (used for GL row PPD inside a facility)

FIX 2 — GL-level PPD:
When viewing a facility drill-in (GL list), the PPD denominator for each GL row is the facility's total person-days for the timeframe (GLs share the facility's census). Each GL row's PPD = (GL spend for this facility+timeframe) / (facility person-days for this timeframe).

Same for the facility drill-in KPI: it's the facility-level aggregate, same denominator as the portfolio rows use for this facility — just don't multiply up to portfolio.

FIX 3 — Vendor-level: disable PPD or show a clear indicator:
When Pivot By = Vendor (inside a GL drill-down), PPD mode should EITHER:
  (a) Show vendor-level PPD using the parent facility's person-days as denominator (same as GLs), OR
  (b) Display a notice: "PPD not applicable at vendor level" and either hide PPD columns or gray them out

Option (a) is mathematically consistent. Choose (a) unless there's a reason not to.

FIX 4 — Fix vendor view "EXCLUDED ITEMS" rendering:
The vendor table is currently rendering all vendor rows under an "EXCLUDED ITEMS" header with muted/excluded styling. Vendors are not excluded items. Remove the "EXCLUDED ITEMS" header from the vendor view entirely. Render vendor rows in normal (non-muted) styling. The excluded-items template is being misapplied from the GL view.

VERIFICATION CHECKLIST — all four levels should work after the fix:

  ✓ Portfolio: KPI shows non-zero PPD, "Based on ~105,000 person-days" for MTD
  ✓ Portfolio: Alderwood row shows Budget PPD ≈ $3,167 (= $3.23M / 1,020)
  ✓ Facility drill-in: KPI shows non-zero PPD (same ≈ $3,167)
  ✓ Facility drill-in: Each GL row shows a PPD value (not "--")
  ✓ GL drill-in: Vendor rows render in normal styling (no EXCLUDED header)
  ✓ GL drill-in: Vendor rows show actual Total Spend (not $0.00)
  ✓ Switching to Dollars still works correctly at all levels
  ✓ Same % values appear in both Dollars and PPD modes (% is unit-independent)

IMPORTANT NOTE:
After the fix, PPD values will jump to a much higher range (~$3,000+ per facility). This looks "wrong" compared to industry PPD of $100–$400, but it is MATHEMATICALLY CORRECT given the current seed data. Each facility has ~$3M in spend over 15 days with ~1,000 person-days, which equals ~$3,000 PPD. The reseed migration (separate effort) is what brings the values into the realistic industry range by redistributing the seed data. Do NOT try to fix this by changing the calculation formula — the formula is correct, the data is unrealistic.
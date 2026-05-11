ARCHITECTURAL FOUNDATION — READ THIS BEFORE MAKING ANY CHANGES

This Budget vs Spend dashboard is governed by a Budget & PPD Kernel specification. The Kernel is the sole authority for financial meaning. This prompt establishes the mandatory boundary between Supabase and Figma Make that ALL subsequent changes must respect.

═══════════════════════════════════════
THE RULE
═══════════════════════════════════════

Supabase edge functions = Kernel (ALL computation)
Figma Make frontend = Display layer (ZERO computation)

This is not a preference. It is a non-negotiable architectural constraint.

═══════════════════════════════════════
WHAT BELONGS IN SUPABASE EDGE FUNCTIONS
═══════════════════════════════════════

All of the following must execute server-side in the edge function and be returned as pre-computed values in the API response:

Financial calculations:
  - Budget totals (Σ DailyBudgetAmount)
  - Spend totals (Σ DailySpendAmount where excluded = false, status = 'ACTIVE')
  - Variance (Spend - Budget)
  - Variance % ((Spend - Budget) / Budget)
  - BurnDown % (Spend / Budget)
  - Budget remaining (Budget - Spend)

PPD calculations:
  - CensusDays (Σ daily census values from bvs.census_daily, resolved to daily grain, ACTUAL overrides PROJECTED)
  - PPD = Spend / CensusDays
  - BudgetPPD = Budget / CensusDays
  - VariancePPD = SpendPPD - BudgetPPD
  - CoverageRatio and ProjectionStatus metadata

Aggregation and rollups:
  - Portfolio-level KPIs aggregated from facility-level totals
  - PPD rollups computed as: aggregate spend ÷ aggregate census days (NEVER average of row-level PPD)
  - Monthly/quarterly breakdowns with per-period computation

Status classification:
  - Over budget (variance % < -5%)
  - On track (variance % between -5% and +5%)
  - Under budget (variance % > +5%)

Date resolution:
  - Timeframe filter resolution (MTD, YTD, trailing 12, etc.)
  - All time-based calculations resolve to daily grain before aggregation

The edge function response for each view should return a complete, ready-to-render payload. Example structure:

  {
    kpi: {
      budgetAvailable: number,
      budgetConsumed: number,
      budgetRemaining: number,
      variance: number,
      variancePercent: number,
      // When metric = PPD:
      personDays: number | null,
      budgetPPD: number | null,
      spendPPD: number | null,
      variancePPD: number | null,
      coverageRatio: number,
      projectionStatus: "ObservedOnly" | "ObservedAndProjected" | "MissingCensus"
    },
    rows: [
      {
        name: string,
        budget: number,
        spend: number,
        variance: number,
        variancePercent: number,
        status: "over_budget" | "on_track" | "under_budget",
        census: number | null,
        censusBasis: "ACTUAL" | "PROJECTED" | null,
        // When metric = PPD:
        budgetPPD: number | null,
        spendPPD: number | null,
        variancePPD: number | null,
        // Sparkline data:
        trendSpend: number[],   // monthly spend values
        trendBudget: number     // average monthly budget
      }
    ],
    meta: {
      timeframeStart: date,
      timeframeEnd: date,
      excludedSpendTotal: number
    }
  }

═══════════════════════════════════════
WHAT BELONGS IN FIGMA MAKE (FRONTEND)
═══════════════════════════════════════

The frontend receives the edge function response and renders it. Period.

The frontend MAY:
  - Map status values to colors (over_budget → red, on_track → yellow, under_budget → green)
  - Format numbers for display (add $ prefix, comma separators, round to 2 decimal places)
  - Sort and filter rows client-side for UI responsiveness
  - Render sparkline charts from pre-computed trendSpend arrays
  - Show/hide columns based on the selected Metric mode
  - Display "--" when a value is null

The frontend MUST NEVER:
  - Divide any two numbers (no PPD calculation, no percentage calculation)
  - Subtract budget from spend (no variance computation)
  - Sum row values to produce KPI totals (KPIs come pre-computed from the edge function)
  - Average PPD values across rows
  - Resolve ACTUAL vs PROJECTED census precedence
  - Interpolate, infer, or fabricate missing data
  - Distribute budget values to a grain that doesn't exist in the schema (e.g. vendor-level budgets)
  - Apply any financial logic not present in the edge function response

═══════════════════════════════════════
HOW TO AUDIT THE CURRENT IMPLEMENTATION
═══════════════════════════════════════

Before making any changes, check the existing Figma Make code for violations of this boundary. Look for:

  1. Any JavaScript that divides two data values (spend / census, variance / budget)
  2. Any client-side subtraction producing variance
  3. Any aggregation loop that sums row values to produce header KPIs
  4. Any conditional logic that assigns status based on comparing spend to budget
  5. Any place where budget is allocated to vendors (vendor-level budgets don't exist in the schema)

If any of these exist, move them to the Supabase edge function. The edge function must return the finished value; the frontend must display it as-received.

═══════════════════════════════════════
SUPABASE SCHEMA REFERENCE
═══════════════════════════════════════

Tables the edge function queries:
  - bvs.facilities (100 rows, facility_id + name with SNF/AL/IL prefix)
  - bvs.gl_accounts (100 rows, 10 excluded)
  - bvs.vendors (400 rows)
  - bvs.transactions (~1.36M rows, amount_actual + amount_committed, excluded flag, status)
  - bvs.budgets_daily (240K rows, monthly grain at facility + GL level, NO vendor grain)
  - bvs.census_daily (83.9K rows, daily grain for ACTUAL, monthly grain for PROJECTED)
  - bvs.exclusions (10 rows, links excluded GLs)

Key join: transactions ↔ budgets_daily on facility_id + gl_account_id + DATE_TRUNC('month', txn_date) = effective_date
Key join: census_daily on facility_id + effective_date (daily) or facility_id + month alignment (projected)

Budget exists at facility + GL grain ONLY. Not at vendor grain. Never fabricate vendor-level budgets.

═══════════════════════════════════════
APPLY THIS TO ALL SUBSEQUENT PROMPTS
═══════════════════════════════════════

Every bug fix or feature prompt that follows should be interpreted through this architectural lens. If a prompt describes a calculation, that calculation belongs in the edge function. If a prompt describes a display change, that belongs in Figma Make. When in doubt, put it in the edge function.
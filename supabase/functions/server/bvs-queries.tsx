/**
 * BVS Query Layer
 *
 * Dynamically builds aggregated report views from the bvs.* Postgres tables.
 * Returns data in the DbViewData shape expected by assembleReportView.
 *
 * PERFORMANCE: Portfolio and facility-level queries read from the pre-aggregated
 * materialized view `bvs.mv_spend_budget_monthly` (facility x GL x month grain).
 * Vendor drill-downs still use raw `bvs.transactions` since the MV lacks vendor_id.
 */

// deno-lint-ignore-file no-explicit-any

// Inlined from former timeframe-utils.tsx (Supabase bundler couldn't resolve the renamed file)
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(s: string | undefined | null): boolean {
  if (!s || typeof s !== "string") return false;
  if (!ISO_DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (isNaN(d.getTime())) return false;
  return s === d.toISOString().slice(0, 10);
}

export function yearRange(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function resolveDateRange(
  startParam: string | undefined,
  endParam: string | undefined,
  yearParam: string | undefined,
  anchorYear: number,
): { startDate: string; endDate: string; isEnriched: boolean } {
  if (startParam && endParam) {
    if (!isValidIsoDate(startParam) || !isValidIsoDate(endParam)) {
      throw new Error(`Invalid date format; expected YYYY-MM-DD. start=${startParam} end=${endParam}`);
    }
    if (startParam > endParam) {
      throw new Error(`start (${startParam}) must be <= end (${endParam})`);
    }
    return { startDate: startParam, endDate: endParam, isEnriched: true };
  }
  const year = yearParam ? Number(yearParam) : anchorYear;
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid year: ${yearParam ?? anchorYear}. Expected integer 2000-2100.`);
  }
  const { start, end } = yearRange(year);
  return { startDate: start, endDate: end, isEnriched: false };
}

export function safePPD(
  value: number | null | undefined,
  days: number | null | undefined,
): number | null {
  if (value == null || days == null) return null;
  const v = Number(value);
  const d = Number(days);
  if (!Number.isFinite(v) || !Number.isFinite(d) || d <= 0) return null;
  return v / d;
}

type SqlClient = any;

// Ship 4a: attach PPD fields to a row using its own personDays denominator.
// Callers pass `personDays` explicitly so GL-root (shared portfolio PD) and
// facility rows (per-facility PD) both work through one helper.
function attachRowPPD(row: any, personDays: number | null | undefined): void {
  row.spendPPD = safePPD(row.spend, personDays);
  row.budgetPPD = safePPD(row.budget, personDays);
  row.variancePPD = safePPD(row.variance, personDays);
}

function attachKpiPPD(kpi: any, personDays: number | null | undefined): void {
  kpi.spendPPD = safePPD(kpi.consumed, personDays);
  kpi.budgetPPD = safePPD(kpi.budget, personDays);
  kpi.variancePPD = safePPD(kpi.variance, personDays);
}

// ---------------------------------------------------------------------------
// Spend Mode helpers
// ---------------------------------------------------------------------------

export type SpendMode = "actual" | "commitment" | "totalImpact";

/** SQL spend expression for the materialized view */
function mvSpendExpr(sm: SpendMode): string {
  if (sm === "actual") return "mv.actual_spend";
  if (sm === "commitment") return "mv.committed_spend";
  return "(mv.actual_spend + mv.committed_spend)";
}

/** SQL spend expression for raw bvs.transactions */
function txnSpendExpr(sm: SpendMode, alias = "t"): string {
  if (sm === "actual") return `${alias}.amount_actual`;
  if (sm === "commitment") return `${alias}.amount_committed`;
  return `(${alias}.amount_actual + ${alias}.amount_committed)`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Cache for discovered transaction columns (populated on first txn query)
let _txnColumnsCache: Set<string> | null = null;

async function getTxnColumns(sql: SqlClient): Promise<Set<string>> {
  if (_txnColumnsCache) return _txnColumnsCache;
  try {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'bvs' AND table_name = 'transactions'
    `;
    _txnColumnsCache = new Set(cols.map((c: any) => c.column_name));
    console.log("BVS txn columns discovered:", [..._txnColumnsCache]);
  } catch (err: any) {
    console.log("BVS column discovery failed:", err?.message);
    _txnColumnsCache = new Set(["id", "facility_id", "gl_account_id", "vendor_id", "txn_date", "amount_actual", "amount_committed", "excluded", "status"]);
  }
  return _txnColumnsCache;
}

function makeContext(pivot: string) {
  return {
    id: `bvs-ctx-${pivot}`,
    timeframeStart: "2025-01-01",
    timeframeEnd: "2025-12-31",
    timeframeType: "ANNUAL",
    viewBy: "fullTimeframe",
    pivotBy: pivot.toUpperCase(),
    metric: "dollars",
    spendMode: "actual",
  };
}

function makeMeta() {
  return {
    id: "bvs-meta-1",
    calculationEngineVersion: "BVS-live-1.0",
    kernelVersion: "pg-direct",
    glIsCanonical: true,
    categoryNotUsed: true,
    spendRuleMode: "ACTUAL_PLUS_COMMITTED",
    spendRuleDeduplication: "NONE",
    timeRuleModel: "CALENDAR",
    timeRuleSupportsMixedModels: false,
  };
}

// Status classification — the single source of truth for budget status
// Must match the arch-foundation spec: over_budget (<-5%), on_track (-5% to +5%), under_budget (>+5%)
type BudgetStatus = "over_budget" | "on_track" | "under_budget" | "excluded"

function classifyStatus(variancePercent: number | null): BudgetStatus {
  if (variancePercent === null) return "excluded"
  if (variancePercent < -5) return "over_budget"
  if (variancePercent > 5) return "under_budget"
  return "on_track"
}

function computeVariancePercent(budget: number, variance: number | null, excluded: boolean): number | null {
  if (excluded || budget === 0) return null
  return ((variance ?? 0) / budget) * 100
}

function makeKpi(rows: any[], viewId: string) {
  const included = rows.filter((r: any) => !r.excluded);
  const excluded = rows.filter((r: any) => r.excluded);
  const budget = included.reduce((s: number, r: any) => s + (r.budget ?? 0), 0);
  const consumed = included.reduce((s: number, r: any) => s + r.spend, 0);
  const variance = budget - consumed;
  const percent = budget === 0 ? null : (variance / budget) * 100;
  const excludedSpend = excluded.reduce((s: number, r: any) => s + r.spend, 0);
  const status = classifyStatus(percent);
  const kpiId = `bvs-kpi-${viewId}`;
  return {
    id: kpiId,
    viewId,
    budget,
    consumed,
    variance,
    percent,
    excludedSpend,
    status,
    reconciliation: {
      kpiId,
      rowCount: rows.length,
      includedRows: included.length,
      excludedRows: excluded.length,
      checksum: `bvs-${rows.length}-${budget}`,
    },
  };
}


/** Ordered month keys for a year (used for trend arrays) */
function orderedMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(year, i, 1));
    return d.toISOString().slice(0, 7); // "2025-01"
  });
}

/** Build per-entity trend data from monthly rows.
 *  Input rows must have: entity_id, month (date), spend (number), budget (number|undefined).
 *  Returns Map<entityId, { trendSpend: number[], trendBudgetAvg: number }> */
function buildTrendMap(
  trendRows: any[],
  year: number,
): Map<string, { trendSpend: number[]; trendBudgetAvg: number }> {
  const months = orderedMonthKeys(year);
  const byEntity = new Map<string, Map<string, { spend: number; budget: number }>>();
  for (const r of trendRows) {
    const eid = r.entity_id;
    const mk = (typeof r.month === "string" ? r.month : (r.month as Date).toISOString()).slice(0, 7);
    if (!byEntity.has(eid)) byEntity.set(eid, new Map());
    const em = byEntity.get(eid)!;
    const existing = em.get(mk) ?? { spend: 0, budget: 0 };
    existing.spend += Number(r.spend ?? 0);
    existing.budget += Number(r.budget ?? 0);
    em.set(mk, existing);
  }
  const result = new Map<string, { trendSpend: number[]; trendBudgetAvg: number }>();
  for (const [eid, em] of byEntity) {
    const trendSpend = months.map(mk => em.get(mk)?.spend ?? 0);
    const budgetValues = months.map(mk => em.get(mk)?.budget ?? 0);
    const budgetSum = budgetValues.reduce((a, b) => a + b, 0);
    const nonZeroBudgetMonths = budgetValues.filter(v => v > 0).length;
    const trendBudgetAvg = nonZeroBudgetMonths > 0 ? Math.round(budgetSum / nonZeroBudgetMonths) : 0;
    result.set(eid, { trendSpend, trendBudgetAvg });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Facility Pivot (uses MV)
// ---------------------------------------------------------------------------

export async function buildFacilityRoot(sql: SqlClient, startDate: string, endDate: string, spendMode: SpendMode = "totalImpact") {
  const viewId = "bvs-fac-root";
  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));
  // Spend is sourced from raw bvs.transactions — the MV's actual_spend/committed_spend
  // columns cannot be trusted to produce different values across spend modes (verified
  // empirically: all three modes returned identical numbers through the MV).
  // Budget stays on the MV since bvs.budgets is a separate dataset.
  const txnSpend = txnSpendExpr(spendMode);

  // Run trend + census queries in parallel — totals are derived from monthly trends below
  const [trendRows, rawTrendRows, facilities, censusRows] = await Promise.all([
    sql.unsafe(`
      SELECT mv.facility_id AS entity_id, mv.month,
        SUM(mv.budget_amount) AS budget,
        SUM(mv.excluded_spend) AS excluded_spend
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.gl_excluded = false
        AND mv.month >= date_trunc('month', '${start}'::date)::date AND mv.month <= '${end}'::date
      GROUP BY mv.facility_id, mv.month
      ORDER BY mv.month
    `),
    sql.unsafe(`
      SELECT t.facility_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS month,
        SUM(${txnSpend}) AS spend,
        SUM(t.amount_committed) AS committed
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE t.excluded = false AND g.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.facility_id, DATE_TRUNC('month', t.txn_date)
    `),
    sql`SELECT id, name FROM bvs.facilities ORDER BY name`,
    // Person-days from census_daily for PPD calculation — monthly granularity
    // so the client can scope to the selected timeframe
    sql.unsafe(`
      SELECT cd.facility_id,
        TO_CHAR(cd.effective_date, 'YYYY-MM') AS month,
        SUM(cd.value) AS person_days
      FROM bvs.census_daily cd
      WHERE cd.effective_date >= '${start}'::date AND cd.effective_date <= '${end}'::date
        AND cd.basis = 'ACTUAL'
      GROUP BY cd.facility_id, TO_CHAR(cd.effective_date, 'YYYY-MM')
    `),
  ]);

  // Latest census per facility — pick most recent record regardless of basis
  // so PROJECTED values show up with a "P" indicator in the UI
  let latestCensusRows: any[] = [];
  try {
    latestCensusRows = await sql.unsafe(`
      SELECT DISTINCT ON (facility_id) facility_id, value AS latest_census, basis AS latest_basis
      FROM bvs.census_daily
      WHERE effective_date <= '${end}'::date
      ORDER BY facility_id, effective_date DESC
    `);
  } catch (e: any) {
    console.log("Census latest query failed (non-fatal):", e?.message);
  }

  // Census coverage metadata — how many days have census data vs total days in timeframe
  let coverageRows: any[] = [];
  try {
    coverageRows = await sql.unsafe(`
      SELECT facility_id,
        COUNT(*) AS days_with_data,
        COUNT(*) FILTER (WHERE basis = 'PROJECTED') AS projected_days
      FROM bvs.census_daily
      WHERE effective_date >= '${start}'::date AND effective_date <= '${end}'::date
      GROUP BY facility_id
    `);
  } catch (e: any) {
    console.log("Census coverage query failed (non-fatal):", e?.message);
  }
  const totalDaysInRange = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
  const coverageMap = new Map(coverageRows.map((r: any) => [r.facility_id, {
    daysWithData: Number(r.days_with_data),
    projectedDays: Number(r.projected_days),
  }]));

  // Derive per-facility totals by summing monthly trend rows (avoids extra full-table scans)
  const mvMap = new Map<string, { spend: number; committed: number; budget: number; excludedSpend: number }>();
  const ensure = (fid: string) => {
    let m = mvMap.get(fid);
    if (!m) { m = { spend: 0, committed: 0, budget: 0, excludedSpend: 0 }; mvMap.set(fid, m); }
    return m;
  };
  for (const r of trendRows) {
    const m = ensure(r.entity_id);
    m.budget += Number(r.budget ?? 0);
    m.excludedSpend += Number(r.excluded_spend ?? 0);
  }
  for (const r of rawTrendRows) {
    const m = ensure(r.entity_id);
    m.spend += Number(r.spend ?? 0);
    m.committed += Number(r.committed ?? 0);
  }

  // Merge trend: budget per-month from MV, spend per-month from raw txn
  const mergedTrendRows = [
    ...trendRows.map((r: any) => ({ entity_id: r.entity_id, month: r.month, spend: 0, budget: Number(r.budget ?? 0) })),
    ...rawTrendRows.map((r: any) => ({ entity_id: r.entity_id, month: r.month, spend: Number(r.spend ?? 0), budget: 0 })),
  ];
  const trendMap = buildTrendMap(mergedTrendRows, year);

  // Build census maps — monthly granularity for timeframe-scoped PPD
  console.log(`BVS census: ${censusRows.length} monthly census rows returned for date range ${start} to ${end}`);
  if (censusRows.length > 0) {
    console.log(`BVS census sample row:`, JSON.stringify(censusRows[0]));
  } else {
    console.log(`BVS census: NO rows returned — check basis='ACTUAL' filter and date range`);
  }
  const monthlyPdMap = new Map<string, Record<string, number>>();
  for (const r of censusRows) {
    const fid = r.facility_id;
    const month = r.month;
    const pd = Number(r.person_days ?? 0);
    if (!monthlyPdMap.has(fid)) monthlyPdMap.set(fid, {});
    monthlyPdMap.get(fid)![month] = pd;
  }
  // Compute annual total per facility
  const personDaysMap = new Map<string, number>();
  for (const [fid, months] of monthlyPdMap) {
    personDaysMap.set(fid, Object.values(months).reduce((a, b) => a + b, 0));
  }
  const latestCensusMap = new Map(latestCensusRows.map((r: any) => [r.facility_id, {
    latestCensus: r.latest_census != null ? Number(r.latest_census) : null,
    latestBasis: r.latest_basis ?? null,
  }]));

  const dbRows = facilities.map((f: any, i: number) => {
    const d = mvMap.get(f.id) ?? { spend: 0, committed: 0, budget: 0, excludedSpend: 0 };
    const variance = d.budget - d.spend;
    const varPct = computeVariancePercent(d.budget, variance, false);
    const trend = trendMap.get(f.id);
    const pd = personDaysMap.get(f.id) ?? null;
    const lc = latestCensusMap.get(f.id);
    const cov = coverageMap.get(f.id);
    const coverageRatio = cov ? cov.daysWithData / totalDaysInRange : 0;
    const projectionStatus = !cov || cov.daysWithData === 0
      ? "MissingCensus"
      : cov.projectedDays > 0
      ? "ObservedAndProjected"
      : "ObservedOnly";
    return {
      id: `bvs-fr-${i}`,
      viewId,
      entityType: "Facility",
      entityId: f.id,
      label: f.name,
      budget: d.budget,
      spend: d.spend,
      committed: d.committed,
      variance,
      variancePercent: varPct,
      status: classifyStatus(varPct),
      excluded: false,
      childViewId: `bvs-fac-${f.id}-gl`,
      po: null,
      invoice: null,
      trendSpend: trend?.trendSpend ?? [],
      trendBudgetAvg: trend?.trendBudgetAvg ?? 0,
      facilityType: null,
      censusValue: lc?.latestCensus ?? null,
      censusBasis: lc?.latestBasis ?? null,
      personDays: pd,
      coverageRatio,
      projectionStatus,
    };
  });

  const kpi = makeKpi(dbRows, viewId);

  // Compute portfolio-level person-days for PPD KPI aggregation
  const totalPersonDays = dbRows.reduce((s: number, r: any) => s + (r.personDays ?? 0), 0);

  // Ship 4a: attach PPD fields per row (each facility uses its own personDays)
  // and to the KPI (portfolio total).
  for (const row of dbRows) {
    attachRowPPD(row, row.personDays);
  }
  attachKpiPPD(kpi, totalPersonDays);

  // Compute portfolio-level monthly person-days for timeframe-scoped KPI PPD
  const monthlyPersonDays: Record<string, number> = {};
  for (const r of dbRows) {
    const mpd = (r as any).monthlyPersonDays as Record<string, number>;
    if (mpd) {
      for (const [month, pd] of Object.entries(mpd)) {
        monthlyPersonDays[month] = (monthlyPersonDays[month] ?? 0) + pd;
      }
    }
  }
  console.log(`BVS PPD: totalPersonDays=${totalPersonDays}, monthlyPd keys=${JSON.stringify(Object.keys(monthlyPersonDays))}, sample facility monthlyPd=${JSON.stringify(dbRows[0]?.monthlyPersonDays)}`);

  // Portfolio-level projection status — if any facility uses projected census, flag it
  const hasProjected = dbRows.some((r: any) => r.projectionStatus === "ObservedAndProjected");
  const allMissing = dbRows.every((r: any) => r.projectionStatus === "MissingCensus");
  const portfolioProjectionStatus = allMissing ? "MissingCensus" : hasProjected ? "ObservedAndProjected" : "ObservedOnly";

  return {
    view: { id: viewId, contextId: "bvs-ctx-facility", metaId: "bvs-meta-1", scopeLabel: "Facilities", entityTypeLabel: "Facilities", kpi: { ...kpi, totalPersonDays, projectionStatus: portfolioProjectionStatus } },
    context: makeContext("facility"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [{ viewId, position: 0, label: "Facilities", targetViewId: null }],
    rows: dbRows,
    rowTimeBuckets: [],
    spendCompositions: [],
    censusContexts: [],
    decompositions: [],
    lineages: [],
    aggregations: [],
    drills: dbRows.map((r: any) => ({ rowId: r.id, nextPivot: "GL Account", available: true })),
    exclusions: [],
  };
}

export async function buildFacilityGlDrill(sql: SqlClient, startDate: string, endDate: string, facilityId: string, spendMode: SpendMode = "totalImpact") {
  const viewId = `bvs-fac-${facilityId}-gl`;
  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));
  // Spend from raw txn (see buildFacilityRoot note). Budget + gl_excluded flag from MV.
  const txnSpend = txnSpendExpr(spendMode);

  const [facility] = await sql`SELECT name FROM bvs.facilities WHERE id = ${facilityId}`;
  if (!facility) return null;
  const facName = facility.name;

  const [mvRows, rawSpendRows, glTrendRows, rawGlTrendRows, censusRows] = await Promise.all([
    sql.unsafe(`
      SELECT mv.gl_account_id, mv.gl_excluded,
        SUM(mv.budget_amount) AS total_budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.facility_id = '${facilityId}'
        AND mv.month >= date_trunc('month', '${start}'::date)::date AND mv.month <= '${end}'::date
      GROUP BY mv.gl_account_id, mv.gl_excluded
    `),
    sql.unsafe(`
      SELECT t.gl_account_id, g.excluded AS gl_excluded,
        SUM(${txnSpend}) AS total_spend,
        SUM(t.amount_committed) AS total_committed
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE t.facility_id = '${facilityId}'
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.gl_account_id, g.excluded
    `),
    sql.unsafe(`
      SELECT mv.gl_account_id AS entity_id, mv.month,
        SUM(mv.budget_amount) AS budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.facility_id = '${facilityId}'
        AND mv.month >= date_trunc('month', '${start}'::date)::date AND mv.month <= '${end}'::date
      GROUP BY mv.gl_account_id, mv.month
      ORDER BY mv.month
    `),
    sql.unsafe(`
      SELECT t.gl_account_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS month,
        SUM(${txnSpend}) AS spend
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE t.facility_id = '${facilityId}'
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.gl_account_id, DATE_TRUNC('month', t.txn_date)
    `),
    sql.unsafe(`
      SELECT TO_CHAR(cd.effective_date, 'YYYY-MM') AS month,
        SUM(cd.value) AS person_days
      FROM bvs.census_daily cd
      WHERE cd.facility_id = '${facilityId}'
        AND cd.effective_date >= '${start}'::date AND cd.effective_date <= '${end}'::date
        AND cd.basis = 'ACTUAL'
      GROUP BY TO_CHAR(cd.effective_date, 'YYYY-MM')
    `),
  ]);
  // Merge trend: MV budget + raw-txn spend per GL+month
  const mergedGlTrendRows = [
    ...glTrendRows.map((r: any) => ({ entity_id: r.entity_id, month: r.month, spend: 0, budget: Number(r.budget ?? 0) })),
    ...rawGlTrendRows.map((r: any) => ({ entity_id: r.entity_id, month: r.month, spend: Number(r.spend ?? 0), budget: 0 })),
  ];
  const glTrendMap = buildTrendMap(mergedGlTrendRows, year);

  // Build facility-scoped monthly person-days map (single map, shared by every GL row)
  const facilityMonthlyPd: Record<string, number> = {};
  for (const r of censusRows) {
    facilityMonthlyPd[r.month] = Number(r.person_days ?? 0);
  }
  const facilityTotalPd = Object.values(facilityMonthlyPd).reduce((a, b) => a + b, 0);
  // Build maps — for non-excluded and excluded GLs. Budget comes from mvRows,
  // spend from rawSpendRows (keyed by gl_account_id).
  const spendMap = new Map<string, { spend: number; committed: number }>();
  const budgetMap = new Map<string, number>();
  const exclSpendMap = new Map<string, { spend: number; committed: number }>();
  const rawSpendByGl = new Map<string, { spend: number; committed: number; excluded: boolean }>();
  for (const r of rawSpendRows) {
    rawSpendByGl.set(r.gl_account_id, {
      spend: Number(r.total_spend ?? 0),
      committed: Number(r.total_committed ?? 0),
      excluded: !!r.gl_excluded,
    });
  }
  for (const r of mvRows) {
    const rs = rawSpendByGl.get(r.gl_account_id) ?? { spend: 0, committed: 0, excluded: r.gl_excluded };
    if (r.gl_excluded) {
      exclSpendMap.set(r.gl_account_id, { spend: rs.spend, committed: rs.committed });
    } else {
      spendMap.set(r.gl_account_id, { spend: rs.spend, committed: rs.committed });
      budgetMap.set(r.gl_account_id, Number(r.total_budget));
    }
  }

  // Get GL account metadata — only GLs that appear in the MV for this facility
  const glIds = [...new Set(mvRows.map((r: any) => r.gl_account_id))];
  let glAccounts: any[] = [];
  if (glIds.length > 0) {
    glAccounts = await sql.unsafe(`
      SELECT id, code, name, excluded FROM bvs.gl_accounts
      WHERE id IN (${glIds.map((id: string) => `'${id}'`).join(",")})
      ORDER BY code
    `);
  }

  // Surface any excluded GLs that have raw-txn activity but no MV row.
  // rawSpendByGl already holds authoritative spend for these (including excluded).
  {
    const existingIds = new Set(glAccounts.map((g: any) => g.id));
    const missingExclIds = [...rawSpendByGl.keys()].filter(id => !existingIds.has(id));
    if (missingExclIds.length > 0) {
      const extraGls = await sql.unsafe(`
        SELECT id, code, name, excluded FROM bvs.gl_accounts
        WHERE id IN (${missingExclIds.map((id: string) => `'${id}'`).join(",")})
      `);
      for (const g of extraGls) {
        glAccounts.push(g);
        const rs = rawSpendByGl.get(g.id)!;
        if (g.excluded) exclSpendMap.set(g.id, { spend: rs.spend, committed: rs.committed });
        else spendMap.set(g.id, { spend: rs.spend, committed: rs.committed });
      }
    }
    glAccounts.sort((a: any, b: any) => (a.code ?? "").localeCompare(b.code ?? ""));
  }

  const dbRows = glAccounts.map((g: any, i: number) => {
    const childViewId = `bvs-fac-${facilityId}-gl-${g.id}-vendor`;
    const trend = glTrendMap.get(g.id);
    if (g.excluded) {
      const es = exclSpendMap.get(g.id) ?? { spend: 0, committed: 0 };
      return { id: `bvs-fgl-${i}`, viewId, entityType: "GL Account", entityId: g.id, label: `${g.code} - ${g.name}`, budget: 0, spend: es.spend, committed: es.committed, variance: null, variancePercent: null, status: "excluded" as BudgetStatus, excluded: true, childViewId, po: null, invoice: null, trendSpend: trend?.trendSpend ?? [], trendBudgetAvg: trend?.trendBudgetAvg ?? 0, personDays: facilityTotalPd };
    }
    const budget = budgetMap.get(g.id) ?? 0;
    const s = spendMap.get(g.id) ?? { spend: 0, committed: 0 };
    const glVariance = budget - s.spend;
    const glVarPct = computeVariancePercent(budget, glVariance, false);
    return { id: `bvs-fgl-${i}`, viewId, entityType: "GL Account", entityId: g.id, label: `${g.code} - ${g.name}`, budget, spend: s.spend, committed: s.committed, variance: glVariance, variancePercent: glVarPct, status: classifyStatus(glVarPct), excluded: false, childViewId, po: null, invoice: null, trendSpend: trend?.trendSpend ?? [], trendBudgetAvg: trend?.trendBudgetAvg ?? 0, personDays: facilityTotalPd };
  });

  const kpi = makeKpi(dbRows, viewId);

  // Ship 4a: facility-GL drill — all GL rows share the facility's personDays.
  for (const row of dbRows) {
    attachRowPPD(row, facilityTotalPd);
  }
  attachKpiPPD(kpi, facilityTotalPd);

  return {
    view: { id: viewId, contextId: "bvs-ctx-facility", metaId: "bvs-meta-1", scopeLabel: `GL Accounts within ${facName}`, entityTypeLabel: "GL Accounts", kpi: { ...kpi, totalPersonDays: facilityTotalPd } },
    context: makeContext("facility"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [
      { viewId, position: 0, label: "Facilities", targetViewId: "bvs-fac-root" },
      { viewId, position: 1, label: facName, targetViewId: null },
    ],
    rows: dbRows,
    rowTimeBuckets: [], spendCompositions: [], censusContexts: [], decompositions: [], lineages: [], aggregations: [],
    drills: dbRows.map((r: any) => ({ rowId: r.id, nextPivot: "Vendor", available: true })),
    exclusions: dbRows.filter((r: any) => r.excluded).map((r: any) => ({ rowId: r.id, impact: "FULL", reason: "GL Account excluded", source: "bvs.exclusions", propagated: false })),
  };
}

// Vendor drill — still uses raw bvs.transactions (MV lacks vendor_id)
export async function buildFacilityGlVendorDrill(sql: SqlClient, startDate: string, endDate: string, facilityId: string, glAccountId: string, spendMode: SpendMode = "totalImpact") {
  const viewId = `bvs-fac-${facilityId}-gl-${glAccountId}-vendor`;
  const spendExpr = txnSpendExpr(spendMode);
  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));

  const [facility] = await sql`SELECT name FROM bvs.facilities WHERE id = ${facilityId}`;
  const [gl] = await sql`SELECT code, name, excluded FROM bvs.gl_accounts WHERE id = ${glAccountId}`;
  if (!facility || !gl) return null;
  const facName = facility.name;
  const glLabel = `${gl.code} - ${gl.name}`;
  const isGlExcluded = gl.excluded;

  // Vendors are not associated with census — use the parent facility's person-days
  // as the PPD denominator (mathematically consistent with GL-row PPD in this facility).
  const censusRows = await sql.unsafe(`
    SELECT TO_CHAR(cd.effective_date, 'YYYY-MM') AS month,
      SUM(cd.value) AS person_days
    FROM bvs.census_daily cd
    WHERE cd.facility_id = '${facilityId}'
      AND cd.effective_date >= '${start}'::date AND cd.effective_date <= '${end}'::date
      AND cd.basis = 'ACTUAL'
    GROUP BY TO_CHAR(cd.effective_date, 'YYYY-MM')
  `);
  const facilityMonthlyPd: Record<string, number> = {};
  for (const r of censusRows) facilityMonthlyPd[r.month] = Number(r.person_days ?? 0);
  const facilityTotalPd = Object.values(facilityMonthlyPd).reduce((a, b) => a + b, 0);

  const [vendorRows, vTrendRows] = await Promise.all([
    sql.unsafe(`
      SELECT v.id, v.name,
        SUM(${spendExpr}) AS total_spend,
        SUM(t.amount_committed) AS total_committed,
        COUNT(*)::int AS txn_count,
        MAX(t.txn_date) AS last_txn_date
      FROM bvs.transactions t
      JOIN bvs.vendors v ON v.id = t.vendor_id
      WHERE t.facility_id = '${facilityId}' AND t.gl_account_id = '${glAccountId}'
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY v.id, v.name ORDER BY v.name
    `),
    sql.unsafe(`
      SELECT t.vendor_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS month,
        SUM(${spendExpr}) AS spend
      FROM bvs.transactions t
      WHERE t.facility_id = '${facilityId}' AND t.gl_account_id = '${glAccountId}'
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.vendor_id, DATE_TRUNC('month', t.txn_date)
    `),
  ]);
  const vTrendMap = buildTrendMap(vTrendRows, year);

  const totalSpend = vendorRows.reduce((s: number, r: any) => s + Number(r.total_spend), 0);
  const vendorCount = vendorRows.length;

  const dbRows = vendorRows.map((v: any, i: number) => {
    const spend = Number(v.total_spend);
    const committed = Number(v.total_committed);
    const txnCount = Number(v.txn_count);
    const avgTransaction = txnCount > 0 ? Math.round(spend / txnCount) : 0;
    const lastTxnDate = v.last_txn_date ? new Date(v.last_txn_date).toISOString().slice(0, 10) : null;
    const trend = vTrendMap.get(v.id);
    return {
      id: `bvs-fv-${i}`, viewId, entityType: "Vendor", entityId: v.id, label: v.name,
      budget: 0, spend, committed, variance: null,
      // Explicit status prevents transform.tsx from defaulting zero-budget vendors to
      // "Excluded" (which triggers the EXCLUDED ITEMS header rendering bug).
      status: (isGlExcluded ? "excluded" : "on_track") as BudgetStatus,
      excluded: isGlExcluded, childViewId: `bvs-fac-${facilityId}-gl-${glAccountId}-vendor-${v.id}-txn`,
      po: null, invoice: null,
      txnCount, avgTransaction, lastTxnDate,
      trendSpend: trend?.trendSpend ?? [], trendBudgetAvg: trend?.trendBudgetAvg ?? 0,
      personDays: facilityTotalPd,
    };
  });

  const kpiId = `bvs-kpi-${viewId}`;
  const kpi = {
    id: kpiId, viewId,
    budget: 0,
    consumed: totalSpend,
    variance: 0,
    percent: 0,
    excludedSpend: 0,
    vendorCount,
    avgSpendPerVendor: vendorCount > 0 ? Math.round(totalSpend / vendorCount) : 0,
    totalPersonDays: facilityTotalPd,
    reconciliation: { kpiId, rowCount: vendorCount, includedRows: vendorCount, excludedRows: 0, checksum: `bvs-vendor-${vendorCount}-${totalSpend}` },
  };

  // Ship 4a: facility-GL-vendor drill — all vendor rows share facility PD.
  for (const row of dbRows) {
    attachRowPPD(row, facilityTotalPd);
  }
  attachKpiPPD(kpi, facilityTotalPd);

  return {
    view: { id: viewId, contextId: "bvs-ctx-facility", metaId: "bvs-meta-1", scopeLabel: `Vendors within ${glLabel}`, entityTypeLabel: "Vendors", kpi },
    context: makeContext("facility"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [
      { viewId, position: 0, label: "Facilities", targetViewId: "bvs-fac-root" },
      { viewId, position: 1, label: facName, targetViewId: `bvs-fac-${facilityId}-gl` },
      { viewId, position: 2, label: glLabel, targetViewId: null },
    ],
    rows: dbRows,
    rowTimeBuckets: [], spendCompositions: [], censusContexts: [], decompositions: [], lineages: [], aggregations: [],
    drills: dbRows.map((r: any) => ({ rowId: r.id, nextPivot: "Transaction", available: true })),
    exclusions: isGlExcluded ? dbRows.map((r: any) => ({ rowId: r.id, impact: "FULL", reason: "GL Account excluded", source: "bvs.exclusions", propagated: true })) : [],
  };
}

export async function buildFacilityGlVendorTxnDrill(sql: SqlClient, startDate: string, endDate: string, facilityId: string, glAccountId: string, vendorId: string, spendMode: SpendMode = "totalImpact") {
  const viewId = `bvs-fac-${facilityId}-gl-${glAccountId}-vendor-${vendorId}-txn`;
  // Ship 4d: define start/end aliases the SQL template references (parity with buildVendorRoot:1117).
  const start = startDate;
  const end = endDate;

  const [facility] = await sql`SELECT name FROM bvs.facilities WHERE id = ${facilityId}`;
  const [gl] = await sql`SELECT code, name, excluded FROM bvs.gl_accounts WHERE id = ${glAccountId}`;
  const [vendor] = await sql`SELECT name FROM bvs.vendors WHERE id = ${vendorId}`;
  if (!facility || !gl || !vendor) return null;
  const facName = facility.name;
  const glLabel = `${gl.code} - ${gl.name}`;
  const isGlExcluded = gl.excluded;

  const cols = await getTxnColumns(sql);
  const hasTxnType = cols.has("txn_type");
  const hasReference = cols.has("reference");
  const hasPo = cols.has("po_number");
  const hasInvoice = cols.has("invoice_number");

  const selectExtra = [
    hasTxnType ? "t.txn_type" : "NULL AS txn_type",
    hasReference ? "t.reference" : "NULL AS reference",
    hasPo ? "t.po_number" : "NULL AS po_number",
    hasInvoice ? "t.invoice_number" : "NULL AS invoice_number",
  ].join(", ");

  const spendExpr = txnSpendExpr(spendMode);

  const txns = await sql.unsafe(`
    SELECT t.id, ${selectExtra}, t.txn_date, t.amount_actual, t.amount_committed, t.excluded,
      ${spendExpr} AS computed_spend
    FROM bvs.transactions t
    WHERE t.facility_id = '${facilityId}' AND t.gl_account_id = '${glAccountId}' AND t.vendor_id = '${vendorId}'
      AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
    ORDER BY t.txn_date DESC LIMIT 2000
  `);

  const dbRows = txns.map((t: any, i: number) => {
    const spend = Number(t.computed_spend);
    const txnType = t.txn_type === "MANUAL_ACCRUAL" ? "MANUAL_ACCRUAL" : (t.po_number && t.invoice_number) ? "PO_AND_INVOICE" : t.po_number ? "PO" : t.invoice_number ? "INVOICE" : null;
    const txnDate = t.txn_date ? new Date(t.txn_date).toISOString().slice(0, 10) : null;
    return { id: `bvs-ft-${i}`, viewId, entityType: "Transaction", entityId: t.id, label: t.reference || `TXN-${t.id}`, budget: null, spend, committed: Number(t.amount_committed), variance: null, excluded: isGlExcluded || t.excluded, childViewId: null, po: t.po_number ?? null, invoice: t.invoice_number ?? null, txnType, lastTxnDate: txnDate };
  });

  const kpi = makeKpi(dbRows, viewId);

  return {
    view: { id: viewId, contextId: "bvs-ctx-facility", metaId: "bvs-meta-1", scopeLabel: `Transactions within ${vendor.name}`, entityTypeLabel: "Transactions", kpi },
    context: makeContext("facility"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [
      { viewId, position: 0, label: "Facilities", targetViewId: "bvs-fac-root" },
      { viewId, position: 1, label: facName, targetViewId: `bvs-fac-${facilityId}-gl` },
      { viewId, position: 2, label: glLabel, targetViewId: `bvs-fac-${facilityId}-gl-${glAccountId}-vendor` },
      { viewId, position: 3, label: vendor.name, targetViewId: null },
    ],
    rows: dbRows,
    rowTimeBuckets: [], spendCompositions: [], censusContexts: [], decompositions: [], lineages: [], aggregations: [],
    drills: [],
    exclusions: dbRows.filter((r: any) => r.excluded).map((r: any) => ({ rowId: r.id, impact: "FULL", reason: isGlExcluded ? "GL excluded" : "Txn excluded", source: "bvs", propagated: isGlExcluded })),
  };
}

// ---------------------------------------------------------------------------
// GL Pivot (uses MV)
// ---------------------------------------------------------------------------

export async function buildGlRoot(sql: SqlClient, startDate: string, endDate: string, spendMode: SpendMode = "totalImpact") {
  const viewId = "bvs-gl-root";
  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));
  // Spend from raw txn (Spend Mode authoritative source). Budget + excluded flag from MV.
  const txnSpend = txnSpendExpr(spendMode);

  const [mvRows, rawSpendRows, glTrendRows, rawGlTrendRows, censusRows] = await Promise.all([
    sql.unsafe(`
      SELECT mv.gl_account_id, mv.gl_excluded,
        SUM(mv.budget_amount) AS total_budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.month >= date_trunc('month', '${start}'::date)::date AND mv.month <= '${end}'::date
      GROUP BY mv.gl_account_id, mv.gl_excluded
    `),
    sql.unsafe(`
      SELECT t.gl_account_id, g.excluded AS gl_excluded,
        SUM(${txnSpend}) AS total_spend,
        SUM(t.amount_committed) AS total_committed
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.gl_account_id, g.excluded
    `),
    sql.unsafe(`
      SELECT mv.gl_account_id AS entity_id, mv.month,
        SUM(mv.budget_amount) AS budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.gl_excluded = false
        AND mv.month >= date_trunc('month', '${start}'::date)::date AND mv.month <= '${end}'::date
      GROUP BY mv.gl_account_id, mv.month
      ORDER BY mv.month
    `),
    sql.unsafe(`
      SELECT t.gl_account_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS month,
        SUM(${txnSpend}) AS spend
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE g.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.gl_account_id, DATE_TRUNC('month', t.txn_date)
    `),
    sql.unsafe(`
      SELECT TO_CHAR(cd.effective_date, 'YYYY-MM') AS month,
        SUM(cd.value) AS person_days
      FROM bvs.census_daily cd
      WHERE cd.effective_date >= '${start}'::date AND cd.effective_date <= '${end}'::date
        AND cd.basis = 'ACTUAL'
      GROUP BY TO_CHAR(cd.effective_date, 'YYYY-MM')
    `),
  ]);
  const mergedGlTrendRows = [
    ...glTrendRows.map((r: any) => ({ entity_id: r.entity_id, month: r.month, spend: 0, budget: Number(r.budget ?? 0) })),
    ...rawGlTrendRows.map((r: any) => ({ entity_id: r.entity_id, month: r.month, spend: Number(r.spend ?? 0), budget: 0 })),
  ];
  const glTrendMap = buildTrendMap(mergedGlTrendRows, year);

  const portfolioMonthlyPd: Record<string, number> = {};
  for (const r of censusRows) portfolioMonthlyPd[r.month] = Number(r.person_days ?? 0);
  const portfolioTotalPd = Object.values(portfolioMonthlyPd).reduce((a, b) => a + b, 0);

  const spendMap = new Map<string, { spend: number; committed: number }>();
  const budgetMap = new Map<string, number>();
  const exclMap = new Map<string, { spend: number; committed: number }>();
  const rawSpendByGl = new Map<string, { spend: number; committed: number; excluded: boolean }>();
  for (const r of rawSpendRows) {
    rawSpendByGl.set(r.gl_account_id, {
      spend: Number(r.total_spend ?? 0),
      committed: Number(r.total_committed ?? 0),
      excluded: !!r.gl_excluded,
    });
  }
  for (const r of mvRows) {
    const rs = rawSpendByGl.get(r.gl_account_id) ?? { spend: 0, committed: 0, excluded: r.gl_excluded };
    if (r.gl_excluded) {
      exclMap.set(r.gl_account_id, { spend: rs.spend, committed: rs.committed });
    } else {
      spendMap.set(r.gl_account_id, { spend: rs.spend, committed: rs.committed });
      budgetMap.set(r.gl_account_id, Number(r.total_budget));
    }
  }
  // Ensure excluded GLs with raw-txn activity but no MV row still appear
  for (const [gid, rs] of rawSpendByGl) {
    if (rs.excluded && !exclMap.has(gid)) {
      exclMap.set(gid, { spend: rs.spend, committed: rs.committed });
    }
  }

  const glAccounts = await sql`SELECT id, code, name, excluded FROM bvs.gl_accounts ORDER BY code`;

  const dbRows = glAccounts.map((g: any, i: number) => {
    const childViewId = `bvs-gl-${g.id}-vendor`;
    const trend = glTrendMap.get(g.id);
    if (g.excluded) {
      const es = exclMap.get(g.id) ?? { spend: 0, committed: 0 };
      return { id: `bvs-gr-${i}`, viewId, entityType: "GL Account", entityId: g.id, label: `${g.code} - ${g.name}`, budget: 0, spend: es.spend, committed: es.committed, variance: null, variancePercent: null, status: "excluded" as BudgetStatus, excluded: true, childViewId, po: null, invoice: null, trendSpend: trend?.trendSpend ?? [], trendBudgetAvg: trend?.trendBudgetAvg ?? 0, personDays: portfolioTotalPd };
    }
    const budget = budgetMap.get(g.id) ?? 0;
    const s = spendMap.get(g.id) ?? { spend: 0, committed: 0 };
    const glVariance = budget - s.spend;
    const glVarPct = computeVariancePercent(budget, glVariance, false);
    return { id: `bvs-gr-${i}`, viewId, entityType: "GL Account", entityId: g.id, label: `${g.code} - ${g.name}`, budget, spend: s.spend, committed: s.committed, variance: glVariance, variancePercent: glVarPct, status: classifyStatus(glVarPct), excluded: false, childViewId, po: null, invoice: null, trendSpend: trend?.trendSpend ?? [], trendBudgetAvg: trend?.trendBudgetAvg ?? 0, personDays: portfolioTotalPd };
  });

  const kpi = makeKpi(dbRows, viewId);

  // Ship 4a V3 fix: shared portfolio PD denominator for every GL row.
  // Doctrine (Confluence 2750840846): category-level PPD uses the
  // portfolio total, not per-entity PD.
  for (const row of dbRows) {
    attachRowPPD(row, portfolioTotalPd);
  }
  attachKpiPPD(kpi, portfolioTotalPd);

  return {
    view: { id: viewId, contextId: "bvs-ctx-glAccount", metaId: "bvs-meta-1", scopeLabel: "GL Accounts", entityTypeLabel: "GL Accounts", kpi: { ...kpi, totalPersonDays: portfolioTotalPd } },
    context: makeContext("glAccount"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [{ viewId, position: 0, label: "GL Accounts", targetViewId: null }],
    rows: dbRows,
    rowTimeBuckets: [], spendCompositions: [], censusContexts: [], decompositions: [], lineages: [], aggregations: [],
    drills: dbRows.map((r: any) => ({ rowId: r.id, nextPivot: "Vendor", available: true })),
    exclusions: dbRows.filter((r: any) => r.excluded).map((r: any) => ({ rowId: r.id, impact: "FULL", reason: "GL Account excluded", source: "bvs.exclusions", propagated: false })),
  };
}

// GL → Vendor drill — still uses raw transactions (vendor grain)
export async function buildGlVendorDrill(sql: SqlClient, startDate: string, endDate: string, glAccountId: string, spendMode: SpendMode = "totalImpact") {
  const viewId = `bvs-gl-${glAccountId}-vendor`;
  const spendExpr = txnSpendExpr(spendMode);
  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));

  const [gl] = await sql`SELECT code, name, excluded FROM bvs.gl_accounts WHERE id = ${glAccountId}`;
  if (!gl) return null;
  const glLabel = `${gl.code} - ${gl.name}`;
  const isExcl = gl.excluded;

  // Portfolio-wide person-days (sum across all facilities). Vendor spend in a GL pivot
  // spans every facility the vendor touches, so the consistent denominator is the
  // portfolio total — same magnitude basis the GL row would use at root level.
  const censusRows = await sql.unsafe(`
    SELECT TO_CHAR(cd.effective_date, 'YYYY-MM') AS month,
      SUM(cd.value) AS person_days
    FROM bvs.census_daily cd
    WHERE cd.effective_date >= '${start}'::date AND cd.effective_date <= '${end}'::date
      AND cd.basis = 'ACTUAL'
    GROUP BY TO_CHAR(cd.effective_date, 'YYYY-MM')
  `);
  const portfolioMonthlyPd: Record<string, number> = {};
  for (const r of censusRows) portfolioMonthlyPd[r.month] = Number(r.person_days ?? 0);
  const portfolioTotalPd = Object.values(portfolioMonthlyPd).reduce((a, b) => a + b, 0);

  const [vendorRows, gvTrendRows] = await Promise.all([
    sql.unsafe(`
      SELECT v.id, v.name,
        SUM(${spendExpr}) AS total_spend,
        SUM(t.amount_committed) AS total_committed,
        COUNT(*)::int AS txn_count,
        MAX(t.txn_date) AS last_txn_date
      FROM bvs.transactions t JOIN bvs.vendors v ON v.id = t.vendor_id
      WHERE t.gl_account_id = '${glAccountId}'
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY v.id, v.name ORDER BY v.name
    `),
    sql.unsafe(`
      SELECT t.vendor_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS month,
        SUM(${spendExpr}) AS spend
      FROM bvs.transactions t
      WHERE t.gl_account_id = '${glAccountId}'
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.vendor_id, DATE_TRUNC('month', t.txn_date)
    `),
  ]);
  const gvTrendMap = buildTrendMap(gvTrendRows, year);

  const totalSpend = vendorRows.reduce((s: number, r: any) => s + Number(r.total_spend), 0);
  const vendorCount = vendorRows.length;

  const dbRows = vendorRows.map((v: any, i: number) => {
    const spend = Number(v.total_spend);
    const committed = Number(v.total_committed);
    const txnCount = Number(v.txn_count);
    const avgTransaction = txnCount > 0 ? Math.round(spend / txnCount) : 0;
    const lastTxnDate = v.last_txn_date ? new Date(v.last_txn_date).toISOString().slice(0, 10) : null;
    const trend = gvTrendMap.get(v.id);
    return {
      id: `bvs-gv-${i}`, viewId, entityType: "Vendor", entityId: v.id, label: v.name,
      budget: 0, spend, committed, variance: null,
      // Explicit status — see buildFacilityGlVendorDrill comment.
      status: (isExcl ? "excluded" : "on_track") as BudgetStatus,
      excluded: isExcl, childViewId: `bvs-gl-${glAccountId}-vendor-${v.id}-txn`,
      po: null, invoice: null,
      txnCount, avgTransaction, lastTxnDate,
      trendSpend: trend?.trendSpend ?? [], trendBudgetAvg: trend?.trendBudgetAvg ?? 0,
      personDays: portfolioTotalPd,
    };
  });

  const kpiId = `bvs-kpi-${viewId}`;
  const kpi = {
    id: kpiId, viewId,
    budget: 0,
    consumed: totalSpend,
    variance: 0,
    percent: 0,
    excludedSpend: 0,
    vendorCount,
    avgSpendPerVendor: vendorCount > 0 ? Math.round(totalSpend / vendorCount) : 0,
    totalPersonDays: portfolioTotalPd,
    reconciliation: { kpiId, rowCount: vendorCount, includedRows: vendorCount, excludedRows: 0, checksum: `bvs-vendor-${vendorCount}-${totalSpend}` },
  };

  // Ship 4a: GL-vendor drill — vendor rows share portfolio PD (same as GL-root).
  for (const row of dbRows) {
    attachRowPPD(row, portfolioTotalPd);
  }
  attachKpiPPD(kpi, portfolioTotalPd);

  return {
    view: { id: viewId, contextId: "bvs-ctx-glAccount", metaId: "bvs-meta-1", scopeLabel: `Vendors within ${glLabel}`, entityTypeLabel: "Vendors", kpi },
    context: makeContext("glAccount"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [
      { viewId, position: 0, label: "GL Accounts", targetViewId: "bvs-gl-root" },
      { viewId, position: 1, label: glLabel, targetViewId: null },
    ],
    rows: dbRows,
    rowTimeBuckets: [], spendCompositions: [], censusContexts: [], decompositions: [], lineages: [], aggregations: [],
    drills: dbRows.map((r: any) => ({ rowId: r.id, nextPivot: "Transaction", available: true })),
    exclusions: isExcl ? dbRows.map((r: any) => ({ rowId: r.id, impact: "FULL", reason: "GL Account excluded", source: "bvs.exclusions", propagated: true })) : [],
  };
}

export async function buildGlVendorTxnDrill(sql: SqlClient, startDate: string, endDate: string, glAccountId: string, vendorId: string, spendMode: SpendMode = "totalImpact") {
  const viewId = `bvs-gl-${glAccountId}-vendor-${vendorId}-txn`;
  // Ship 4d: define start/end aliases the SQL template references (parity with buildVendorRoot:1117).
  const start = startDate;
  const end = endDate;

  const [gl] = await sql`SELECT code, name, excluded FROM bvs.gl_accounts WHERE id = ${glAccountId}`;
  const [vendor] = await sql`SELECT name FROM bvs.vendors WHERE id = ${vendorId}`;
  if (!gl || !vendor) return null;
  const glLabel = `${gl.code} - ${gl.name}`;
  const isExcl = gl.excluded;

  const cols = await getTxnColumns(sql);
  const hasTxnType = cols.has("txn_type");
  const hasReference = cols.has("reference");
  const hasPo = cols.has("po_number");
  const hasInvoice = cols.has("invoice_number");

  const selectExtra = [
    hasTxnType ? "t.txn_type" : "NULL AS txn_type",
    hasReference ? "t.reference" : "NULL AS reference",
    hasPo ? "t.po_number" : "NULL AS po_number",
    hasInvoice ? "t.invoice_number" : "NULL AS invoice_number",
  ].join(", ");

  const spendExpr = txnSpendExpr(spendMode);

  const txns = await sql.unsafe(`
    SELECT t.id, ${selectExtra}, t.txn_date, t.amount_actual, t.amount_committed, t.excluded,
      ${spendExpr} AS computed_spend
    FROM bvs.transactions t
    WHERE t.gl_account_id = '${glAccountId}' AND t.vendor_id = '${vendorId}'
      AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
    ORDER BY t.txn_date DESC LIMIT 2000
  `);

  const dbRows = txns.map((t: any, i: number) => {
    const spend = Number(t.computed_spend);
    const txnType = t.txn_type === "MANUAL_ACCRUAL" ? "MANUAL_ACCRUAL" : (t.po_number && t.invoice_number) ? "PO_AND_INVOICE" : t.po_number ? "PO" : t.invoice_number ? "INVOICE" : null;
    const txnDate = t.txn_date ? new Date(t.txn_date).toISOString().slice(0, 10) : null;
    return { id: `bvs-gt-${i}`, viewId, entityType: "Transaction", entityId: t.id, label: t.reference || `TXN-${t.id}`, budget: null, spend, committed: Number(t.amount_committed), variance: null, excluded: isExcl || t.excluded, childViewId: null, po: t.po_number ?? null, invoice: t.invoice_number ?? null, txnType, lastTxnDate: txnDate };
  });

  const kpi = makeKpi(dbRows, viewId);

  return {
    view: { id: viewId, contextId: "bvs-ctx-glAccount", metaId: "bvs-meta-1", scopeLabel: `Transactions within ${vendor.name}`, entityTypeLabel: "Transactions", kpi },
    context: makeContext("glAccount"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [
      { viewId, position: 0, label: "GL Accounts", targetViewId: "bvs-gl-root" },
      { viewId, position: 1, label: glLabel, targetViewId: `bvs-gl-${glAccountId}-vendor` },
      { viewId, position: 2, label: vendor.name, targetViewId: null },
    ],
    rows: dbRows,
    rowTimeBuckets: [], spendCompositions: [], censusContexts: [], decompositions: [], lineages: [], aggregations: [],
    drills: [],
    exclusions: dbRows.filter((r: any) => r.excluded).map((r: any) => ({ rowId: r.id, impact: "FULL", reason: isExcl ? "GL excluded" : "Txn excluded", source: "bvs", propagated: isExcl })),
  };
}

// ---------------------------------------------------------------------------
// Vendor Pivot (uses raw transactions — MV lacks vendor grain)
// ---------------------------------------------------------------------------

export async function buildVendorRoot(sql: SqlClient, startDate: string, endDate: string, spendMode: SpendMode = "totalImpact") {
  const viewId = "bvs-vendor-root";
  const spendExpr = txnSpendExpr(spendMode);
  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));

  const [vendorRows, vrTrendRows, censusRows] = await Promise.all([
    sql.unsafe(`
      SELECT v.id, v.name,
        SUM(${spendExpr}) AS total_spend,
        SUM(t.amount_committed) AS total_committed,
        COUNT(*)::int AS txn_count,
        MAX(t.txn_date) AS last_txn_date
      FROM bvs.transactions t
      JOIN bvs.vendors v ON v.id = t.vendor_id
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE t.excluded = false AND g.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY v.id, v.name ORDER BY v.name
    `),
    sql.unsafe(`
      SELECT t.vendor_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS month,
        SUM(${spendExpr}) AS spend
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE t.excluded = false AND g.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.vendor_id, DATE_TRUNC('month', t.txn_date)
    `),
    sql.unsafe(`
      SELECT TO_CHAR(cd.effective_date, 'YYYY-MM') AS month,
        SUM(cd.value) AS person_days
      FROM bvs.census_daily cd
      WHERE cd.effective_date >= '${start}'::date AND cd.effective_date <= '${end}'::date
        AND cd.basis = 'ACTUAL'
      GROUP BY TO_CHAR(cd.effective_date, 'YYYY-MM')
    `),
  ]);
  const vrTrendMap = buildTrendMap(vrTrendRows, year);
  const portfolioMonthlyPd: Record<string, number> = {};
  for (const r of censusRows) portfolioMonthlyPd[r.month] = Number(r.person_days ?? 0);
  const portfolioTotalPd = Object.values(portfolioMonthlyPd).reduce((a, b) => a + b, 0);

  const totalSpend = vendorRows.reduce((s: number, r: any) => s + Number(r.total_spend), 0);
  const vendorCount = vendorRows.length;

  const dbRows = vendorRows.map((v: any, i: number) => {
    const spend = Number(v.total_spend);
    const committed = Number(v.total_committed);
    const txnCount = Number(v.txn_count);
    const avgTransaction = txnCount > 0 ? Math.round(spend / txnCount) : 0;
    const lastTxnDate = v.last_txn_date ? new Date(v.last_txn_date).toISOString().slice(0, 10) : null;
    const trend = vrTrendMap.get(v.id);
    return {
      id: `bvs-vr-${i}`, viewId, entityType: "Vendor", entityId: v.id, label: v.name,
      budget: 0, spend, committed, variance: null,
      // Explicit status — see buildFacilityGlVendorDrill comment.
      status: "on_track" as BudgetStatus,
      excluded: false, childViewId: `bvs-vendor-${v.id}-fac`,
      po: null, invoice: null,
      txnCount, avgTransaction, lastTxnDate,
      trendSpend: trend?.trendSpend ?? [], trendBudgetAvg: trend?.trendBudgetAvg ?? 0,
      personDays: portfolioTotalPd,
    };
  });

  const kpiId = `bvs-kpi-${viewId}`;
  const kpi = {
    id: kpiId, viewId,
    budget: 0,
    consumed: totalSpend,
    variance: 0,
    percent: 0,
    excludedSpend: 0,
    vendorCount,
    avgSpendPerVendor: vendorCount > 0 ? Math.round(totalSpend / vendorCount) : 0,
    reconciliation: { kpiId, rowCount: vendorCount, includedRows: vendorCount, excludedRows: 0, checksum: `bvs-vendor-${vendorCount}-${totalSpend}` },
    totalPersonDays: portfolioTotalPd,
  };

  // Ship 4a: vendor-root — shared portfolio PD.
  for (const row of dbRows) {
    attachRowPPD(row, portfolioTotalPd);
  }
  attachKpiPPD(kpi, portfolioTotalPd);

  return {
    view: { id: viewId, contextId: "bvs-ctx-vendor", metaId: "bvs-meta-1", scopeLabel: "Vendors", entityTypeLabel: "Vendors", kpi },
    context: makeContext("vendor"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [{ viewId, position: 0, label: "Vendors", targetViewId: null }],
    rows: dbRows,
    rowTimeBuckets: [], spendCompositions: [], censusContexts: [], decompositions: [], lineages: [], aggregations: [],
    drills: dbRows.map((r: any) => ({ rowId: r.id, nextPivot: "Facility", available: true })),
    exclusions: [],
  };
}

export async function buildVendorFacDrill(sql: SqlClient, startDate: string, endDate: string, vendorId: string, spendMode: SpendMode = "totalImpact") {
  const viewId = `bvs-vendor-${vendorId}-fac`;
  const spendExpr = txnSpendExpr(spendMode);

  const [vendor] = await sql`SELECT name FROM bvs.vendors WHERE id = ${vendorId}`;
  if (!vendor) return null;

  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));
  const [facRows, budgetRows, vfTrendRows, censusRows] = await Promise.all([
    sql.unsafe(`
      SELECT f.id, f.name,
        SUM(${spendExpr}) AS total_spend,
        SUM(t.amount_committed) AS total_committed
      FROM bvs.transactions t
      JOIN bvs.facilities f ON f.id = t.facility_id
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE t.vendor_id = '${vendorId}' AND t.excluded = false AND g.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY f.id, f.name ORDER BY f.name
    `),
    sql.unsafe(`
      SELECT mv.facility_id, SUM(mv.budget_amount) AS total_budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.gl_excluded = false
        AND mv.month >= date_trunc('month', '${start}'::date)::date AND mv.month <= '${end}'::date
        AND mv.gl_account_id IN (
          SELECT DISTINCT gl_account_id FROM bvs.transactions WHERE vendor_id = '${vendorId}'
        )
      GROUP BY mv.facility_id
    `),
    sql.unsafe(`
      SELECT t.facility_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS month,
        SUM(${spendExpr}) AS spend
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE t.vendor_id = '${vendorId}' AND t.excluded = false AND g.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.facility_id, DATE_TRUNC('month', t.txn_date)
    `),
    sql.unsafe(`
      SELECT cd.facility_id, TO_CHAR(cd.effective_date, 'YYYY-MM') AS month,
        SUM(cd.value) AS person_days
      FROM bvs.census_daily cd
      WHERE cd.effective_date >= '${start}'::date AND cd.effective_date <= '${end}'::date
        AND cd.basis = 'ACTUAL'
      GROUP BY cd.facility_id, TO_CHAR(cd.effective_date, 'YYYY-MM')
    `),
  ]);
  const vfTrendMap = buildTrendMap(vfTrendRows, year);
  const budgetMap = new Map(budgetRows.map((r: any) => [r.facility_id, Number(r.total_budget)]));
  const totalSpend = facRows.reduce((s: number, r: any) => s + Number(r.total_spend), 0);

  // Per-facility monthly person-days (each row gets its own facility's denominator)
  const facMonthlyPdMap = new Map<string, Record<string, number>>();
  for (const r of censusRows) {
    const fid = r.facility_id;
    if (!facMonthlyPdMap.has(fid)) facMonthlyPdMap.set(fid, {});
    facMonthlyPdMap.get(fid)![r.month] = Number(r.person_days ?? 0);
  }
  // KPI denominator: sum across the facilities this vendor actually touches
  const portfolioMonthlyPd: Record<string, number> = {};
  for (const f of facRows) {
    const m = facMonthlyPdMap.get(f.id) ?? {};
    for (const [k, v] of Object.entries(m)) portfolioMonthlyPd[k] = (portfolioMonthlyPd[k] ?? 0) + v;
  }
  const portfolioTotalPd = Object.values(portfolioMonthlyPd).reduce((a, b) => a + b, 0);

  const dbRows = facRows.map((f: any, i: number) => {
    const spend = Number(f.total_spend);
    const committed = Number(f.total_committed);
    const facBudget = budgetMap.get(f.id) ?? 0;
    const proportion = totalSpend > 0 ? spend / totalSpend : 0;
    const budget = Math.round(facBudget * proportion);
    const vfVariance = budget - spend;
    const vfVarPct = computeVariancePercent(budget, vfVariance, false);
    const trend = vfTrendMap.get(f.id);
    const monthlyPd = facMonthlyPdMap.get(f.id) ?? {};
    const facPd = Object.values(monthlyPd).reduce((a, b) => a + b, 0);
    return { id: `bvs-vf-${i}`, viewId, entityType: "Facility", entityId: f.id, label: f.name, budget, spend, committed, variance: vfVariance, variancePercent: vfVarPct, status: classifyStatus(vfVarPct), excluded: false, childViewId: `bvs-vendor-${vendorId}-fac-${f.id}-txn`, po: null, invoice: null, trendSpend: trend?.trendSpend ?? [], trendBudgetAvg: trend?.trendBudgetAvg ?? 0, personDays: facPd };
  });

  const kpi = makeKpi(dbRows, viewId);

  // Ship 4a: vendor→facility drill — each facility row uses its own PD;
  // KPI uses portfolio total (sum of touched facilities).
  for (const row of dbRows) {
    attachRowPPD(row, row.personDays);
  }
  attachKpiPPD(kpi, portfolioTotalPd);

  return {
    view: { id: viewId, contextId: "bvs-ctx-vendor", metaId: "bvs-meta-1", scopeLabel: `Facilities within ${vendor.name}`, entityTypeLabel: "Facilities", kpi: { ...kpi, totalPersonDays: portfolioTotalPd } },
    context: makeContext("vendor"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [
      { viewId, position: 0, label: "Vendors", targetViewId: "bvs-vendor-root" },
      { viewId, position: 1, label: vendor.name, targetViewId: null },
    ],
    rows: dbRows,
    rowTimeBuckets: [], spendCompositions: [], censusContexts: [], decompositions: [], lineages: [], aggregations: [],
    drills: dbRows.map((r: any) => ({ rowId: r.id, nextPivot: "Transaction", available: true })),
    exclusions: [],
  };
}

export async function buildVendorFacTxnDrill(sql: SqlClient, startDate: string, endDate: string, vendorId: string, facilityId: string, spendMode: SpendMode = "totalImpact") {
  const viewId = `bvs-vendor-${vendorId}-fac-${facilityId}-txn`;
  // Ship 4d: define start/end aliases the SQL template references (parity with buildVendorRoot:1117).
  const start = startDate;
  const end = endDate;

  const [vendor] = await sql`SELECT name FROM bvs.vendors WHERE id = ${vendorId}`;
  const [facility] = await sql`SELECT name FROM bvs.facilities WHERE id = ${facilityId}`;
  if (!vendor || !facility) return null;

  const cols = await getTxnColumns(sql);
  const hasTxnType = cols.has("txn_type");
  const hasReference = cols.has("reference");
  const hasPo = cols.has("po_number");
  const hasInvoice = cols.has("invoice_number");

  const selectExtra = [
    hasTxnType ? "t.txn_type" : "NULL AS txn_type",
    hasReference ? "t.reference" : "NULL AS reference",
    hasPo ? "t.po_number" : "NULL AS po_number",
    hasInvoice ? "t.invoice_number" : "NULL AS invoice_number",
  ].join(", ");

  const spendExpr = txnSpendExpr(spendMode);

  const txns = await sql.unsafe(`
    SELECT t.id, ${selectExtra}, t.txn_date, t.amount_actual, t.amount_committed, t.excluded,
      ${spendExpr} AS computed_spend
    FROM bvs.transactions t
    JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
    WHERE t.vendor_id = '${vendorId}' AND t.facility_id = '${facilityId}'
      AND t.excluded = false AND g.excluded = false
      AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
    ORDER BY t.txn_date DESC LIMIT 2000
  `);

  const dbRows = txns.map((t: any, i: number) => {
    const spend = Number(t.computed_spend);
    const txnType = t.txn_type === "MANUAL_ACCRUAL" ? "MANUAL_ACCRUAL" : (t.po_number && t.invoice_number) ? "PO_AND_INVOICE" : t.po_number ? "PO" : t.invoice_number ? "INVOICE" : null;
    const txnDate = t.txn_date ? new Date(t.txn_date).toISOString().slice(0, 10) : null;
    return { id: `bvs-vt-${i}`, viewId, entityType: "Transaction", entityId: t.id, label: t.reference || `TXN-${t.id}`, budget: null, spend, committed: Number(t.amount_committed), variance: null, excluded: false, childViewId: null, po: t.po_number ?? null, invoice: t.invoice_number ?? null, txnType, lastTxnDate: txnDate };
  });

  const kpi = makeKpi(dbRows, viewId);

  return {
    view: { id: viewId, contextId: "bvs-ctx-vendor", metaId: "bvs-meta-1", scopeLabel: `Transactions within ${facility.name}`, entityTypeLabel: "Transactions", kpi },
    context: makeContext("vendor"),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs: [
      { viewId, position: 0, label: "Vendors", targetViewId: "bvs-vendor-root" },
      { viewId, position: 1, label: vendor.name, targetViewId: `bvs-vendor-${vendorId}-fac` },
      { viewId, position: 2, label: facility.name, targetViewId: null },
    ],
    rows: dbRows,
    rowTimeBuckets: [], spendCompositions: [], censusContexts: [], decompositions: [], lineages: [], aggregations: [],
    drills: [],
    exclusions: [],
  };
}

// ---------------------------------------------------------------------------
// Facility names
// ---------------------------------------------------------------------------

export async function getFacilityNames(sql: SqlClient): Promise<string[]> {
  const rows = await sql`SELECT name FROM bvs.facilities ORDER BY name`;
  return rows.map((r: any) => r.name);
}

// ---------------------------------------------------------------------------
// Period breakdown queries (monthly / quarterly)
// ---------------------------------------------------------------------------

type PeriodGranularity = "monthly" | "quarterly";

function truncExpr(g: PeriodGranularity): string {
  return g === "quarterly" ? "quarter" : "month";
}

function formatPeriodKey(d: Date | string, g: PeriodGranularity): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-based
  if (g === "quarterly") {
    const q = Math.floor(m / 3) + 1;
    return `Q${q} ${y}`;
  }
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${MONTHS[m]} ${y}`;
}

// Ship 4c: period buckets may carry server-computed PPD when isEnriched=true.
// PPD is null when person-days for that period <= 0 (no census data).
type PeriodBucket = {
  spend: number;
  budget: number;
  committed: number;
  spendPPD?: number | null;
  budgetPPD?: number | null;
  variancePPD?: number | null;
};
type PeriodMap = Record<string, Record<string, PeriodBucket>>;

// Ship 4c: per-period person-days lookup.
// "portfolio" scope returns one PD value per period (shared denominator across
// all entities — used for GL-root, Vendor-root, GlVendor period payloads per
// V3 doctrine).
// "facility" scope returns per-facility-per-period PD (used for Facility-root,
// FacGl, FacGlVendor, VendorFac period payloads).
type PeriodPdPortfolio = Record<string, number>; // periodKey -> pd
type PeriodPdFacility = Record<string, Record<string, number>>; // facilityId -> periodKey -> pd

/**
 * Ship 4c: fetch per-period person-days from census_daily.
 * Returns either portfolio-shared (one PD per period) or per-facility
 * (PD per facility per period) depending on the V3 doctrine for the caller.
 *
 * Mirrors the basis='ACTUAL' filter used by view-builder census queries
 * (see lines ~278-285) so per-period and full-window denominators are
 * computed from the same underlying data.
 */
async function fetchPeriodPersonDays(
  sql: SqlClient,
  trunc: string,
  gran: PeriodGranularity,
  startDate: string,
  endDate: string,
  scope: "portfolio",
): Promise<PeriodPdPortfolio>;
async function fetchPeriodPersonDays(
  sql: SqlClient,
  trunc: string,
  gran: PeriodGranularity,
  startDate: string,
  endDate: string,
  scope: "facility",
): Promise<PeriodPdFacility>;
async function fetchPeriodPersonDays(
  sql: SqlClient,
  trunc: string,
  gran: PeriodGranularity,
  startDate: string,
  endDate: string,
  scope: "portfolio" | "facility",
): Promise<PeriodPdPortfolio | PeriodPdFacility> {
  if (scope === "portfolio") {
    const rows = await sql.unsafe(`
      SELECT DATE_TRUNC('${trunc}', cd.effective_date) AS period,
        SUM(cd.value) AS person_days
      FROM bvs.census_daily cd
      WHERE cd.effective_date >= '${startDate}'::date
        AND cd.effective_date <= '${endDate}'::date
        AND cd.basis = 'ACTUAL'
      GROUP BY DATE_TRUNC('${trunc}', cd.effective_date)
    `);
    const lookup: PeriodPdPortfolio = {};
    for (const r of rows) {
      const pk = formatPeriodKey(r.period, gran);
      lookup[pk] = Number(r.person_days ?? 0);
    }
    return lookup;
  }
  // facility scope
  const rows = await sql.unsafe(`
    SELECT cd.facility_id,
      DATE_TRUNC('${trunc}', cd.effective_date) AS period,
      SUM(cd.value) AS person_days
    FROM bvs.census_daily cd
    WHERE cd.effective_date >= '${startDate}'::date
      AND cd.effective_date <= '${endDate}'::date
      AND cd.basis = 'ACTUAL'
    GROUP BY cd.facility_id, DATE_TRUNC('${trunc}', cd.effective_date)
  `);
  const lookup: PeriodPdFacility = {};
  for (const r of rows) {
    const fid = r.facility_id;
    const pk = formatPeriodKey(r.period, gran);
    if (!lookup[fid]) lookup[fid] = {};
    lookup[fid][pk] = Number(r.person_days ?? 0);
  }
  return lookup;
}

/**
 * Ship 4c: round PPD to 2 decimals matching the row-level rounding policy
 * established in Ship 4a (safePPD helper). Returns null for non-finite or
 * undefined inputs so the bucket can render "--".
 */
function roundPPD(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export async function buildPeriodBreakdown(
  sql: SqlClient,
  viewId: string,
  granularity: PeriodGranularity,
  startDate: string,
  endDate: string,
  spendMode: SpendMode = "totalImpact",
  wantPPD: boolean = false,
): Promise<PeriodMap> {
  const trunc = truncExpr(granularity);

  // Parse viewId to determine the grouping dimension
  if (viewId === "bvs-fac-root") {
    return buildFacilityRootPeriods(sql, trunc, granularity, startDate, endDate, spendMode, wantPPD);
  }
  if (viewId === "bvs-gl-root") {
    return buildGlRootPeriods(sql, trunc, granularity, startDate, endDate, spendMode, wantPPD);
  }
  if (viewId === "bvs-vendor-root") {
    return buildVendorRootPeriods(sql, trunc, granularity, startDate, endDate, spendMode, wantPPD);
  }
  // Facility -> GL drill
  const facGlMatch = viewId.match(/^bvs-fac-(.+)-gl$/);
  if (facGlMatch) {
    return buildFacGlPeriods(sql, trunc, granularity, startDate, endDate, facGlMatch[1], spendMode, wantPPD);
  }
  // Facility -> GL -> Vendor drill
  const facGlVendorMatch = viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor$/);
  if (facGlVendorMatch) {
    return buildFacGlVendorPeriods(sql, trunc, granularity, startDate, endDate, facGlVendorMatch[1], facGlVendorMatch[2], spendMode, wantPPD);
  }
  // GL -> Vendor drill
  const glVendorMatch = viewId.match(/^bvs-gl-(.+)-vendor$/);
  if (glVendorMatch) {
    return buildGlVendorPeriods(sql, trunc, granularity, startDate, endDate, glVendorMatch[1], spendMode, wantPPD);
  }
  // Vendor -> Facility drill
  const vendorFacMatch = viewId.match(/^bvs-vendor-(.+)-fac$/);
  if (vendorFacMatch) {
    return buildVendorFacPeriods(sql, trunc, granularity, startDate, endDate, vendorFacMatch[1], spendMode, wantPPD);
  }
  // Transaction-level views: no meaningful period breakdown (already have dates)
  return {};
}

// Facility root periods — spend from raw txn, budget from MV
async function buildFacilityRootPeriods(sql: SqlClient, trunc: string, gran: PeriodGranularity, startDate: string, endDate: string, spendMode: SpendMode, wantPPD: boolean = false): Promise<PeriodMap> {
  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));
  const txnSpend = txnSpendExpr(spendMode);
  const [spendRows, budgetRows, pdLookup] = await Promise.all([
    sql.unsafe(`
      SELECT t.facility_id AS entity_id, DATE_TRUNC('${trunc}', t.txn_date) AS period,
        SUM(${txnSpend}) AS spend,
        SUM(t.amount_committed) AS committed
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE g.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.facility_id, DATE_TRUNC('${trunc}', t.txn_date)
    `),
    sql.unsafe(`
      SELECT mv.facility_id AS entity_id, DATE_TRUNC('${trunc}', mv.month) AS period,
        SUM(mv.budget_amount) AS budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.gl_excluded = false
        AND mv.month >= date_trunc('month', '${start}'::date)::date AND mv.month <= '${end}'::date
      GROUP BY mv.facility_id, DATE_TRUNC('${trunc}', mv.month)
    `),
    // Ship 4c: per-facility per-period person-days for V3 doctrine PPD.
    // Entity in this view IS a facility, so denominator is per-entity.
    wantPPD ? fetchPeriodPersonDays(sql, trunc, gran, start, end, "facility") : Promise.resolve(null),
  ]);
  return mergePeriodData(spendRows, budgetRows, gran, pdLookup ?? null, wantPPD ? "facility-by-entity" : undefined);
}

// GL root periods — spend from raw txn, budget from MV
async function buildGlRootPeriods(sql: SqlClient, trunc: string, gran: PeriodGranularity, startDate: string, endDate: string, spendMode: SpendMode, wantPPD: boolean = false): Promise<PeriodMap> {
  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));
  const txnSpend = txnSpendExpr(spendMode);
  const [spendRows, budgetRows, pdLookup] = await Promise.all([
    sql.unsafe(`
      SELECT t.gl_account_id AS entity_id, DATE_TRUNC('${trunc}', t.txn_date) AS period,
        SUM(${txnSpend}) AS spend,
        SUM(t.amount_committed) AS committed
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE g.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.gl_account_id, DATE_TRUNC('${trunc}', t.txn_date)
    `),
    sql.unsafe(`
      SELECT mv.gl_account_id AS entity_id, DATE_TRUNC('${trunc}', mv.month) AS period,
        SUM(mv.budget_amount) AS budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.gl_excluded = false
        AND mv.month >= date_trunc('month', '${start}'::date)::date AND mv.month <= '${end}'::date
      GROUP BY mv.gl_account_id, DATE_TRUNC('${trunc}', mv.month)
    `),
    // Ship 4c: shared portfolio per-period PD (V3 doctrine — same denominator
    // across all GL rows for a given period).
    wantPPD ? fetchPeriodPersonDays(sql, trunc, gran, start, end, "portfolio") : Promise.resolve(null),
  ]);
  return mergePeriodData(spendRows, budgetRows, gran, pdLookup ?? null, wantPPD ? "portfolio" : undefined);
}

// Vendor root periods — raw transactions (no vendor in MV)
async function buildVendorRootPeriods(sql: SqlClient, trunc: string, gran: PeriodGranularity, startDate: string, endDate: string, spendMode: SpendMode, wantPPD: boolean = false): Promise<PeriodMap> {
  // Ship 4c: declare start/end locals (existing code referenced them in the
  // SQL template literal without declaring them — silently substituted
  // "undefined" before this fix).
  const start = startDate;
  const end = endDate;
  const spendExpr = txnSpendExpr(spendMode);
  const [spendRows, pdLookup] = await Promise.all([
    sql.unsafe(`
      SELECT t.vendor_id AS entity_id, DATE_TRUNC('${trunc}', t.txn_date) AS period,
        SUM(${spendExpr}) AS spend,
        SUM(t.amount_committed) AS committed
      FROM bvs.transactions t
      WHERE t.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.vendor_id, DATE_TRUNC('${trunc}', t.txn_date)
    `),
    // Ship 4c: shared portfolio per-period PD (V3 doctrine — same denominator
    // across all Vendor rows for a given period).
    wantPPD ? fetchPeriodPersonDays(sql, trunc, gran, start, end, "portfolio") : Promise.resolve(null),
  ]);
  return mergePeriodData(spendRows, [], gran, pdLookup ?? null, wantPPD ? "portfolio" : undefined);
}

// Facility → GL periods — spend from raw txn, budget from MV
async function buildFacGlPeriods(sql: SqlClient, trunc: string, gran: PeriodGranularity, startDate: string, endDate: string, facilityId: string, spendMode: SpendMode, wantPPD: boolean = false): Promise<PeriodMap> {
  const start = startDate;
  const end = endDate;
  // Ship 4a: derive year from endDate for trend/sparkline call sites that
  // remain year-scoped (12-month trailing arrays indexed by calendar month).
  const year = Number(endDate.slice(0, 4));
  const txnSpend = txnSpendExpr(spendMode);
  const [spendRows, budgetRows, pdLookup] = await Promise.all([
    sql.unsafe(`
      SELECT t.gl_account_id AS entity_id, DATE_TRUNC('${trunc}', t.txn_date) AS period,
        SUM(${txnSpend}) AS spend,
        SUM(t.amount_committed) AS committed
      FROM bvs.transactions t
      WHERE t.facility_id = '${facilityId}'
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.gl_account_id, DATE_TRUNC('${trunc}', t.txn_date)
    `),
    sql.unsafe(`
      SELECT mv.gl_account_id AS entity_id, DATE_TRUNC('${trunc}', mv.month) AS period,
        SUM(mv.budget_amount) AS budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.facility_id = '${facilityId}'
        AND mv.month >= date_trunc('month', '${start}'::date)::date AND mv.month <= '${end}'::date
      GROUP BY mv.gl_account_id, DATE_TRUNC('${trunc}', mv.month)
    `),
    // Ship 4c: per-period PD scoped to this facility — V3 doctrine for a
    // within-facility drill uses the facility's own PD as the shared denominator
    // across all its GL rows.
    wantPPD ? fetchPeriodPersonDays(sql, trunc, gran, start, end, "facility") : Promise.resolve(null),
  ]);
  return mergePeriodData(spendRows, budgetRows, gran, pdLookup ?? null, wantPPD ? "facility-fixed" : undefined, facilityId);
}

// Facility → GL → Vendor periods — raw transactions (vendor grain)
async function buildFacGlVendorPeriods(sql: SqlClient, trunc: string, gran: PeriodGranularity, startDate: string, endDate: string, facilityId: string, glAccountId: string, spendMode: SpendMode, wantPPD: boolean = false): Promise<PeriodMap> {
  // Ship 4c: declare start/end locals (existing code referenced them in the
  // SQL template literal without declaring them).
  const start = startDate;
  const end = endDate;
  const spendExpr = txnSpendExpr(spendMode);
  const [spendRows, pdLookup] = await Promise.all([
    sql.unsafe(`
      SELECT t.vendor_id AS entity_id, DATE_TRUNC('${trunc}', t.txn_date) AS period,
        SUM(${spendExpr}) AS spend,
        SUM(t.amount_committed) AS committed
      FROM bvs.transactions t
      WHERE t.facility_id = '${facilityId}' AND t.gl_account_id = '${glAccountId}'
        AND t.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.vendor_id, DATE_TRUNC('${trunc}', t.txn_date)
    `),
    // Ship 4c: per-period PD scoped to this facility — V3 doctrine for a
    // within-facility drill uses the facility's own PD as the shared denominator.
    wantPPD ? fetchPeriodPersonDays(sql, trunc, gran, start, end, "facility") : Promise.resolve(null),
  ]);
  return mergePeriodData(spendRows, [], gran, pdLookup ?? null, wantPPD ? "facility-fixed" : undefined, facilityId);
}

// GL → Vendor periods — raw transactions
async function buildGlVendorPeriods(sql: SqlClient, trunc: string, gran: PeriodGranularity, startDate: string, endDate: string, glAccountId: string, spendMode: SpendMode, wantPPD: boolean = false): Promise<PeriodMap> {
  // Ship 4c: declare start/end locals (existing code referenced them in the
  // SQL template literal without declaring them).
  const start = startDate;
  const end = endDate;
  const spendExpr = txnSpendExpr(spendMode);
  const [spendRows, pdLookup] = await Promise.all([
    sql.unsafe(`
      SELECT t.vendor_id AS entity_id, DATE_TRUNC('${trunc}', t.txn_date) AS period,
        SUM(${spendExpr}) AS spend,
        SUM(t.amount_committed) AS committed
      FROM bvs.transactions t
      WHERE t.gl_account_id = '${glAccountId}'
        AND t.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.vendor_id, DATE_TRUNC('${trunc}', t.txn_date)
    `),
    // Ship 4c: shared portfolio per-period PD (V3 doctrine — vendor rows
    // within a portfolio-wide GL drill share the portfolio denominator).
    wantPPD ? fetchPeriodPersonDays(sql, trunc, gran, start, end, "portfolio") : Promise.resolve(null),
  ]);
  return mergePeriodData(spendRows, [], gran, pdLookup ?? null, wantPPD ? "portfolio" : undefined);
}

// Vendor → Facility periods — raw transactions
async function buildVendorFacPeriods(sql: SqlClient, trunc: string, gran: PeriodGranularity, startDate: string, endDate: string, vendorId: string, spendMode: SpendMode, wantPPD: boolean = false): Promise<PeriodMap> {
  // Ship 4c: declare start/end locals (existing code referenced them in the
  // SQL template literal without declaring them).
  const start = startDate;
  const end = endDate;
  const spendExpr = txnSpendExpr(spendMode);
  const [spendRows, pdLookup] = await Promise.all([
    sql.unsafe(`
      SELECT t.facility_id AS entity_id, DATE_TRUNC('${trunc}', t.txn_date) AS period,
        SUM(${spendExpr}) AS spend,
        SUM(t.amount_committed) AS committed
      FROM bvs.transactions t
      WHERE t.vendor_id = '${vendorId}'
        AND t.excluded = false
        AND t.txn_date >= '${start}'::date AND t.txn_date <= '${end}'::date
      GROUP BY t.facility_id, DATE_TRUNC('${trunc}', t.txn_date)
    `),
    // Ship 4c: per-facility per-period PD (entity here IS a facility).
    wantPPD ? fetchPeriodPersonDays(sql, trunc, gran, start, end, "facility") : Promise.resolve(null),
  ]);
  return mergePeriodData(spendRows, [], gran, pdLookup ?? null, wantPPD ? "facility-by-entity" : undefined);
}

/**
 * Unified period merge — handles rows that have spend+budget in one row (MV) or separate (legacy).
 *
 * Ship 4c: when `pdLookup` is provided, attaches per-period spendPPD/budgetPPD/variancePPD
 * to each bucket using the V3 doctrine denominator. Lookup may be:
 *   - PeriodPdPortfolio: one PD per period (shared across all entities — for root + GL-vendor views)
 *   - PeriodPdFacility:  PD per facility per period (per-entity — for facility + facility-grain drills)
 * The `entityIsFacility` flag tells us how to interpret PeriodPdFacility:
 *   - true: lookup keyed by entityId directly (entity == facility)
 *   - false: lookup keyed by some other id (single facility — caller passes a one-element map keyed by that facility's id)
 *
 * Without pdLookup, behavior is unchanged from Ship 4b — no PPD fields, no v2 shape.
 */
function mergePeriodData(
  spendRows: any[],
  budgetRows: any[],
  gran: PeriodGranularity,
  pdLookup?: PeriodPdPortfolio | PeriodPdFacility | null,
  pdScope?: "portfolio" | "facility-by-entity" | "facility-fixed",
  facilityIdForFixed?: string,
): PeriodMap {
  const result: PeriodMap = {};
  for (const r of spendRows) {
    const eid = r.entity_id;
    const pk = formatPeriodKey(r.period, gran);
    if (!result[eid]) result[eid] = {};
    if (!result[eid][pk]) result[eid][pk] = { spend: 0, budget: 0, committed: 0 };
    result[eid][pk].spend += Number(r.spend);
    result[eid][pk].committed += Number(r.committed);
    // If the row also has budget (MV queries), add it
    if (r.budget !== undefined && r.budget !== null) {
      result[eid][pk].budget += Number(r.budget);
    }
  }
  for (const r of budgetRows) {
    const eid = r.entity_id;
    const pk = formatPeriodKey(r.period, gran);
    if (!result[eid]) result[eid] = {};
    if (!result[eid][pk]) result[eid][pk] = { spend: 0, budget: 0, committed: 0 };
    result[eid][pk].budget += Number(r.budget);
  }

  // Ship 4c: attach per-period PPD if lookup provided. V3 doctrine — denominator
  // depends on scope:
  //   portfolio:           shared PD across all entities for a given period
  //   facility-by-entity:  per-entity PD (entity is a facility id)
  //   facility-fixed:      shared PD across all entities (drill is scoped to one facility)
  if (pdLookup && pdScope) {
    for (const eid of Object.keys(result)) {
      for (const pk of Object.keys(result[eid])) {
        const bucket = result[eid][pk];
        let pd: number;
        if (pdScope === "portfolio") {
          pd = (pdLookup as PeriodPdPortfolio)[pk] ?? 0;
        } else if (pdScope === "facility-by-entity") {
          pd = ((pdLookup as PeriodPdFacility)[eid] ?? {})[pk] ?? 0;
        } else { // facility-fixed
          const fid = facilityIdForFixed ?? "";
          pd = ((pdLookup as PeriodPdFacility)[fid] ?? {})[pk] ?? 0;
        }
        if (pd <= 0) {
          bucket.spendPPD = null;
          bucket.budgetPPD = null;
          bucket.variancePPD = null;
        } else {
          const variance = bucket.budget - bucket.spend;
          bucket.spendPPD = roundPPD(bucket.spend / pd);
          bucket.budgetPPD = roundPPD(bucket.budget / pd);
          bucket.variancePPD = roundPPD(variance / pd);
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sparkline data — trailing 12 months of monthly spend + budget per entity
// ---------------------------------------------------------------------------

export type SparklinePoint = { month: string; spend: number | null; budget: number }

export type SparklineMap = Record<string, SparklinePoint[]>

export async function buildSparklineData(
  sql: SqlClient,
  viewId: string,
  year: number,
  spendMode: SpendMode = "totalImpact",
): Promise<SparklineMap> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  if (viewId === "bvs-fac-root") {
    return buildFacilitySparklines(sql, startDate, endDate, year, spendMode);
  }
  if (viewId === "bvs-gl-root") {
    return buildGlSparklines(sql, startDate, endDate, year, spendMode);
  }
  if (viewId === "bvs-vendor-root") {
    return buildVendorSparklines(sql, startDate, endDate, year, spendMode);
  }
  // Facility -> GL drill
  const facGlMatch = viewId.match(/^bvs-fac-(.+)-gl$/);
  if (facGlMatch) {
    return buildFacGlSparklines(sql, startDate, endDate, year, facGlMatch[1], spendMode);
  }
  // Facility -> GL -> Vendor drill
  const facGlVendorMatch = viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor$/);
  if (facGlVendorMatch) {
    return buildVendorOnlySparklines(sql, startDate, endDate, year, { facilityId: facGlVendorMatch[1], glAccountId: facGlVendorMatch[2] }, spendMode);
  }
  // GL -> Vendor drill
  const glVendorMatch = viewId.match(/^bvs-gl-(.+)-vendor$/);
  if (glVendorMatch) {
    return buildVendorOnlySparklines(sql, startDate, endDate, year, { glAccountId: glVendorMatch[1] }, spendMode);
  }
  // Vendor -> Facility drill
  const vendorFacMatch = viewId.match(/^bvs-vendor-(.+)-fac$/);
  if (vendorFacMatch) {
    return buildVendorFacSparklines(sql, startDate, endDate, year, vendorFacMatch[1], spendMode);
  }
  return {};
}

function generateMonthKeys(year: number): string[] {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return MONTHS.map((m, i) => `${m} ${year}`);
}

function monthKeyFromDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

// Facility sparklines — spend from raw txn, budget from MV
async function buildFacilitySparklines(sql: SqlClient, startDate: string, endDate: string, year: number, spendMode: SpendMode): Promise<SparklineMap> {
  const txnSpend = txnSpendExpr(spendMode);
  const [spendRows, budgetRows] = await Promise.all([
    sql.unsafe(`
      SELECT t.facility_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS period,
        SUM(${txnSpend}) AS spend
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE g.excluded = false
        AND t.txn_date >= '${startDate}'::date AND t.txn_date <= '${endDate}'::date
      GROUP BY t.facility_id, DATE_TRUNC('month', t.txn_date)
    `),
    sql.unsafe(`
      SELECT mv.facility_id AS entity_id, mv.month AS period,
        SUM(mv.budget_amount) AS budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.gl_excluded = false
        AND mv.month >= '${startDate}'::date AND mv.month <= '${endDate}'::date
      GROUP BY mv.facility_id, mv.month
    `),
  ]);
  return assembleSparklines(spendRows, budgetRows, year, false);
}

// GL sparklines — spend from raw txn, budget from MV
async function buildGlSparklines(sql: SqlClient, startDate: string, endDate: string, year: number, spendMode: SpendMode): Promise<SparklineMap> {
  const txnSpend = txnSpendExpr(spendMode);
  const [spendRows, budgetRows] = await Promise.all([
    sql.unsafe(`
      SELECT t.gl_account_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS period,
        SUM(${txnSpend}) AS spend
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE g.excluded = false
        AND t.txn_date >= '${startDate}'::date AND t.txn_date <= '${endDate}'::date
      GROUP BY t.gl_account_id, DATE_TRUNC('month', t.txn_date)
    `),
    sql.unsafe(`
      SELECT mv.gl_account_id AS entity_id, mv.month AS period,
        SUM(mv.budget_amount) AS budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.gl_excluded = false
        AND mv.month >= '${startDate}'::date AND mv.month <= '${endDate}'::date
      GROUP BY mv.gl_account_id, mv.month
    `),
  ]);
  return assembleSparklines(spendRows, budgetRows, year, false);
}

// Vendor sparklines — raw transactions (vendor grain not in MV)
async function buildVendorSparklines(sql: SqlClient, startDate: string, endDate: string, year: number, spendMode: SpendMode): Promise<SparklineMap> {
  const spendExpr = txnSpendExpr(spendMode);
  const spendRows = await sql.unsafe(`
    SELECT t.vendor_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS period,
      SUM(${spendExpr}) AS spend
    FROM bvs.transactions t
    JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
    WHERE t.excluded = false AND g.excluded = false
      AND t.txn_date >= '${startDate}'::date AND t.txn_date <= '${endDate}'::date
    GROUP BY t.vendor_id, DATE_TRUNC('month', t.txn_date)
  `);
  return assembleSparklines(spendRows, [], year, false);
}

// Facility → GL sparklines — spend from raw txn, budget from MV
async function buildFacGlSparklines(sql: SqlClient, startDate: string, endDate: string, year: number, facilityId: string, spendMode: SpendMode): Promise<SparklineMap> {
  const txnSpend = txnSpendExpr(spendMode);
  const [spendRows, budgetRows] = await Promise.all([
    sql.unsafe(`
      SELECT t.gl_account_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS period,
        SUM(${txnSpend}) AS spend
      FROM bvs.transactions t
      JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
      WHERE t.facility_id = '${facilityId}' AND g.excluded = false
        AND t.txn_date >= '${startDate}'::date AND t.txn_date <= '${endDate}'::date
      GROUP BY t.gl_account_id, DATE_TRUNC('month', t.txn_date)
    `),
    sql.unsafe(`
      SELECT mv.gl_account_id AS entity_id, mv.month AS period,
        SUM(mv.budget_amount) AS budget
      FROM bvs.mv_spend_budget_monthly mv
      WHERE mv.facility_id = '${facilityId}' AND mv.gl_excluded = false
        AND mv.month >= '${startDate}'::date AND mv.month <= '${endDate}'::date
      GROUP BY mv.gl_account_id, mv.month
    `),
  ]);
  return assembleSparklines(spendRows, budgetRows, year, false);
}

// Vendor-only sparklines (Fac→GL→Vendor or GL→Vendor) — raw transactions
async function buildVendorOnlySparklines(
  sql: SqlClient, startDate: string, endDate: string, year: number,
  filter: { facilityId?: string; glAccountId?: string },
  spendMode: SpendMode,
): Promise<SparklineMap> {
  const spendExpr = txnSpendExpr(spendMode);
  const conditions = [`t.txn_date >= '${startDate}'::date`, `t.txn_date <= '${endDate}'::date`];
  if (filter.facilityId) conditions.push(`t.facility_id = '${filter.facilityId}'`);
  if (filter.glAccountId) conditions.push(`t.gl_account_id = '${filter.glAccountId}'`);
  const where = conditions.join(" AND ");
  const spendRows = await sql.unsafe(`
    SELECT t.vendor_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS period,
      SUM(${spendExpr}) AS spend
    FROM bvs.transactions t
    WHERE ${where}
    GROUP BY t.vendor_id, DATE_TRUNC('month', t.txn_date)
  `);
  return assembleSparklines(spendRows, [], year, false);
}

// Vendor → Facility sparklines — MV for budget, raw txn for spend
async function buildVendorFacSparklines(sql: SqlClient, startDate: string, endDate: string, year: number, vendorId: string, spendMode: SpendMode): Promise<SparklineMap> {
  const spendExpr = txnSpendExpr(spendMode);
  const spendRows = await sql.unsafe(`
    SELECT t.facility_id AS entity_id, DATE_TRUNC('month', t.txn_date) AS period,
      SUM(${spendExpr}) AS spend
    FROM bvs.transactions t
    JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
    WHERE t.vendor_id = '${vendorId}'
      AND t.excluded = false AND g.excluded = false
      AND t.txn_date >= '${startDate}'::date AND t.txn_date <= '${endDate}'::date
    GROUP BY t.facility_id, DATE_TRUNC('month', t.txn_date)
  `);
  // Budget from MV
  const budgetRows = await sql.unsafe(`
    SELECT mv.facility_id AS entity_id, mv.month AS period,
      SUM(mv.budget_amount) AS budget
    FROM bvs.mv_spend_budget_monthly mv
    WHERE mv.gl_excluded = false
      AND mv.facility_id IN (
        SELECT DISTINCT facility_id FROM bvs.transactions WHERE vendor_id = '${vendorId}'
      )
      AND mv.gl_account_id IN (
        SELECT DISTINCT gl_account_id FROM bvs.transactions WHERE vendor_id = '${vendorId}'
      )
      AND mv.month >= '${startDate}'::date AND mv.month <= '${endDate}'::date
    GROUP BY mv.facility_id, mv.month
  `);
  return assembleSparklines(spendRows, budgetRows, year, false);
}

/** Build sparkline arrays from spend/budget rows.
 *  If `spendRowsHaveBudget` is true, budget is inline in the spend rows (MV pattern).
 */
function assembleSparklines(spendRows: any[], budgetRows: any[], year: number, spendRowsHaveBudget: boolean): SparklineMap {
  const months = generateMonthKeys(year);
  const spendMap = new Map<string, Map<string, number>>();
  const budgetMap = new Map<string, Map<string, number>>();

  for (const r of spendRows) {
    const eid = r.entity_id;
    const mk = monthKeyFromDate(r.period);
    if (!spendMap.has(eid)) spendMap.set(eid, new Map());
    spendMap.get(eid)!.set(mk, (spendMap.get(eid)!.get(mk) ?? 0) + Number(r.spend));
    if (spendRowsHaveBudget && r.budget !== undefined && r.budget !== null) {
      if (!budgetMap.has(eid)) budgetMap.set(eid, new Map());
      budgetMap.get(eid)!.set(mk, (budgetMap.get(eid)!.get(mk) ?? 0) + Number(r.budget));
    }
  }
  for (const r of budgetRows) {
    const eid = r.entity_id;
    const mk = monthKeyFromDate(r.period);
    if (!budgetMap.has(eid)) budgetMap.set(eid, new Map());
    budgetMap.get(eid)!.set(mk, (budgetMap.get(eid)!.get(mk) ?? 0) + Number(r.budget));
  }

  const allEntityIds = new Set([...spendMap.keys(), ...budgetMap.keys()]);
  const result: SparklineMap = {};

  for (const eid of allEntityIds) {
    const entitySpend = spendMap.get(eid);
    const entityBudget = budgetMap.get(eid);
    result[eid] = months.map(m => ({
      month: m,
      spend: entitySpend?.get(m) ?? null,  // null = gap (no data)
      budget: entityBudget?.get(m) ?? 0,
    }));
  }
  return result;
}
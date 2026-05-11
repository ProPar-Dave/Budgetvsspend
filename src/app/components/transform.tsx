/**
 * Transformation Layer
 *
 * Typed functions that map database-shaped records (Db*) into
 * payload-shaped objects (ReportView, ReportRow, etc.).
 *
 * This is the single path from database shape to UI payload shape.
 */

import type {
  DbReportContext, DbTimeBucket, DbRow, DbRowTimeBucket,
  DbSpendComposition, DbCensusContext, DbDecomposition,
  DbLineage, DbAggregation, DbDrill, DbExclusion,
  DbReportMeta, DbBreadcrumbSegment, DbView, DbCensusDisplay,
  DbKpi,
} from "./db-types"

import type {
  ReportContext, TimeBucketDefinition, TimeBucketValue,
  ReportKpi, KpiReconciliation, ReportRow, ReportMeta,
  BreadcrumbSegment, ReportView, SpendComposition,
  CensusContext, Decomposition, Lineage, Aggregation,
  Drill, ExclusionInfo,
} from "./data-source"

// ---------------------------------------------------------------------------
// Context transform
// ---------------------------------------------------------------------------

export function transformContext(db: DbReportContext): ReportContext {
  return {
    timeframe: {
      start: db.timeframeStart,
      end: db.timeframeEnd,
      type: db.timeframeType,
    },
    viewBy: db.viewBy,
    pivotBy: db.pivotBy,
    metric: db.metric,
    spendMode: db.spendMode,
  }
}

// ---------------------------------------------------------------------------
// Time bucket transform
// ---------------------------------------------------------------------------

export function transformTimeBuckets(dbs: DbTimeBucket[]): TimeBucketDefinition[] {
  return dbs.map(db => ({
    id: db.id,
    label: db.label,
    start: db.start,
    end: db.end,
    bucketType: db.bucketType,
    timeModel: db.timeModel,
    decompositionId: db.decompositionId,
  }))
}

// ---------------------------------------------------------------------------
// Meta transform
// ---------------------------------------------------------------------------

export function transformMeta(db: DbReportMeta): ReportMeta {
  return {
    calculationEngineVersion: db.calculationEngineVersion,
    kernelVersion: db.kernelVersion,
    governance: {
      glIsCanonical: db.glIsCanonical,
      categoryNotUsed: db.categoryNotUsed,
    },
    spendRules: {
      mode: db.spendRuleMode,
      deduplication: db.spendRuleDeduplication,
    },
    timeRules: {
      model: db.timeRuleModel,
      supportsMixedModels: db.timeRuleSupportsMixedModels,
    },
  }
}

// ---------------------------------------------------------------------------
// Row transform
// ---------------------------------------------------------------------------

export type DbRowRelated = {
  timeBuckets: DbRowTimeBucket[]
  spendComposition: DbSpendComposition | null
  censusContext: DbCensusContext | null
  decomposition: DbDecomposition | null
  lineage: DbLineage | null
  aggregation: DbAggregation | null
  drill: DbDrill | null
  exclusion: DbExclusion | null
}

export function transformRow(db: DbRow, related: DbRowRelated): ReportRow {
  const excluded = db.excluded
  const budget = excluded ? 0 : (db.budget ?? 0)

  // Use server-provided variancePercent and status (authoritative)
  // Fall back to client-side derivation only for legacy data without these fields
  const variancePercent = db.variancePercent !== undefined
    ? db.variancePercent
    : (excluded || db.budget === null || db.budget === 0
      ? null
      : Math.round(((db.variance ?? 0) / db.budget) * 100))

  const serverStatus = db.status
  // Entity types that have no budget-vs-spend concept (vendors, transactions).
  // These rows legitimately have budget=0 and must NOT be classified as "Excluded".
  const hasNoBudgetConcept = db.entityType === "Vendor" || db.entityType === "Transaction"
  const status: ReportRow["status"] = serverStatus
    ? (serverStatus === "over_budget" ? "Over Budget"
      : serverStatus === "on_track" ? "On Track"
      : serverStatus === "under_budget" ? "Under Budget"
      : "Excluded")
    : (excluded
      ? "Excluded"
      : hasNoBudgetConcept
      ? "On Track"
      : (db.budget ?? 0) === 0
      ? "Excluded"
      : variancePercent !== null && variancePercent < -5
      ? "Over Budget"
      : variancePercent !== null && variancePercent > 5
      ? "Under Budget"
      : "On Track")

  // Transform time bucket values
  const timeBuckets: Record<string, TimeBucketValue> = {}
  for (const tb of related.timeBuckets) {
    timeBuckets[tb.bucketId] = {
      total: tb.total,
      actual: tb.actual,
      commitment: tb.commitment,
      deduplicated: tb.deduplicated,
    }
  }

  // Transform spend composition
  const spendComposition: SpendComposition | null = related.spendComposition
    ? {
        actualTotal: related.spendComposition.actualTotal,
        commitmentOpen: related.spendComposition.commitmentOpen,
        commitmentRealized: related.spendComposition.commitmentRealized,
      }
    : null

  // Transform census context
  const censusContext: CensusContext | null = related.censusContext
    ? {
        basedOn: related.censusContext.basedOn,
        actualPercent: related.censusContext.actualPercent,
        projectedPercent: related.censusContext.projectedPercent,
        impactsPPD: related.censusContext.impactsPPD,
      }
    : null

  // Transform decomposition
  const decomposition: Decomposition | null = related.decomposition
    ? {
        source: related.decomposition.source,
        method: related.decomposition.method,
        remainderHandling: related.decomposition.remainderHandling,
        auditId: related.decomposition.auditId,
      }
    : null

  // Transform lineage
  const lineage: Lineage | null = related.lineage
    ? {
        budget: related.lineage.budget,
        spend: related.lineage.spend,
        census: related.lineage.census,
        time: related.lineage.time,
      }
    : null

  // Transform aggregation
  const aggregation: Aggregation | null = related.aggregation
    ? {
        method: related.aggregation.method,
        childReconciliation: related.aggregation.childReconciliation,
      }
    : null

  // Transform drill
  const drill: Drill | null = related.drill
    ? {
        nextPivot: related.drill.nextPivot,
        available: related.drill.available,
      }
    : null

  // Transform exclusion
  const exclusionImpact = related.exclusion?.impact ?? (excluded ? "FULL" : "NONE")
  const exclusionInfo: ExclusionInfo | null = related.exclusion
    ? {
        reason: related.exclusion.reason ?? "Unknown",
        source: related.exclusion.source ?? "Unknown",
        propagated: related.exclusion.propagated,
      }
    : excluded
    ? { reason: "All GL Accounts excluded", source: "Budget Kernel", propagated: true }
    : null

  return {
    id: db.id,
    entityType: db.entityType,
    entityId: db.entityId,
    label: db.label,
    budget,
    spend: db.spend,
    variance: excluded ? null : db.variance,
    variancePercent,
    status,
    excluded,
    childViewId: db.childViewId,
    timeBuckets,
    committed: db.committed,
    po: db.po,
    invoice: db.invoice,
    txnType: db.txnType ?? (db.entityType === "Transaction"
      ? (db.po && db.invoice ? "PO_AND_INVOICE" : db.po ? "PO" : db.invoice ? "INVOICE" : null)
      : null),
    spendComposition,
    censusContext,
    decomposition,
    lineage,
    aggregation,
    exclusionImpact: exclusionImpact as ReportRow["exclusionImpact"],
    exclusionInfo,
    drill,
    // Vendor drill-down operational fields (pass through if present)
    txnCount: db.txnCount,
    avgTransaction: db.avgTransaction,
    lastTxnDate: db.lastTxnDate,
    facilityType: db.facilityType,
    censusValue: db.censusValue,
    censusBasis: db.censusBasis,
    personDays: db.personDays,
    personDaysByType: (db as any).personDaysByType,
    monthlyPersonDays: db.monthlyPersonDays,
    // Ship 4b: server-computed PPD values (v2 enriched only; undefined on legacy)
    spendPPD: (db as any).spendPPD ?? undefined,
    budgetPPD: (db as any).budgetPPD ?? undefined,
    variancePPD: (db as any).variancePPD ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// KPI transform from authoritative DbKpi source
// ---------------------------------------------------------------------------

export function transformKpi(dbKpi: DbKpi): ReportKpi {
  return {
    budget: dbKpi.budget,
    consumed: dbKpi.consumed,
    variance: dbKpi.variance,
    percent: dbKpi.percent ?? 0,
    excludedSpend: dbKpi.excludedSpend,
    status: dbKpi.status,
    reconciliation: {
      rowCount: dbKpi.reconciliation.rowCount,
      includedRows: dbKpi.reconciliation.includedRows,
      excludedRows: dbKpi.reconciliation.excludedRows,
      checksum: dbKpi.reconciliation.checksum,
    },
    // Pass through PPD census fields from edge function
    totalPersonDays: (dbKpi as any).totalPersonDays ?? 0,
    monthlyPersonDays: (dbKpi as any).monthlyPersonDays ?? undefined,
    projectionStatus: (dbKpi as any).projectionStatus ?? null,
    // Ship 4b: server-computed PPD values (v2 enriched only; undefined on legacy)
    spendPPD: (dbKpi as any).spendPPD ?? undefined,
    budgetPPD: (dbKpi as any).budgetPPD ?? undefined,
    variancePPD: (dbKpi as any).variancePPD ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// KPI computation from rows (DRIFT CHECK ONLY — not authoritative)
//
// This function exists solely for development-time drift detection.
// It must NEVER be used as the source of KPI values in production.
// The authoritative KPI comes from DbView.kpi (backed by budgets_daily
// in the future Postgres model).
// ---------------------------------------------------------------------------

export function computeKpiFromRows(rows: ReportRow[]): ReportKpi {
  const nonExcluded = rows.filter(r => !r.excluded)
  const excluded = rows.filter(r => r.excluded)
  const totalBudget = nonExcluded.reduce((s, r) => s + (r.budget ?? 0), 0)
  const totalConsumed = nonExcluded.reduce((s, r) => s + r.spend, 0)
  const totalVariance = totalBudget - totalConsumed
  const variancePercent = totalBudget === 0 ? 0 : (totalVariance / totalBudget) * 100
  const totalExcludedSpend = excluded.reduce((s, r) => s + r.spend, 0)
  return {
    budget: totalBudget,
    consumed: totalConsumed,
    variance: totalVariance,
    percent: variancePercent,
    excludedSpend: totalExcludedSpend,
    reconciliation: {
      rowCount: rows.length,
      includedRows: nonExcluded.length,
      excludedRows: excluded.length,
      checksum: `chk-${rows.length}-${totalBudget}`,
    },
  }
}

// ---------------------------------------------------------------------------
// Breadcrumb transform
// ---------------------------------------------------------------------------

export function transformBreadcrumbs(dbs: DbBreadcrumbSegment[]): BreadcrumbSegment[] {
  return dbs
    .sort((a, b) => a.position - b.position)
    .map(db => ({
      label: db.label,
      viewId: db.targetViewId,
    }))
}

// ---------------------------------------------------------------------------
// Full view assembly
// ---------------------------------------------------------------------------

export type DbViewData = {
  view: DbView
  context: DbReportContext
  meta: DbReportMeta
  timeBuckets: DbTimeBucket[]
  breadcrumbs: DbBreadcrumbSegment[]
  rows: DbRow[]
  rowTimeBuckets: DbRowTimeBucket[]
  spendCompositions: DbSpendComposition[]
  censusContexts: DbCensusContext[]
  decompositions: DbDecomposition[]
  lineages: DbLineage[]
  aggregations: DbAggregation[]
  drills: DbDrill[]
  exclusions: DbExclusion[]
}

export function assembleReportView(data: DbViewData): ReportView {
  // Build lookup maps for row-level related data
  const tbByRow = new Map<string, DbRowTimeBucket[]>()
  for (const tb of data.rowTimeBuckets) {
    const arr = tbByRow.get(tb.rowId) ?? []
    arr.push(tb)
    tbByRow.set(tb.rowId, arr)
  }

  const scMap = new Map(data.spendCompositions.map(s => [s.rowId, s]))
  const ccMap = new Map(data.censusContexts.map(c => [c.rowId, c]))
  const dcMap = new Map(data.decompositions.map(d => [d.rowId, d]))
  const lnMap = new Map(data.lineages.map(l => [l.rowId, l]))
  const agMap = new Map(data.aggregations.map(a => [a.rowId, a]))
  const drMap = new Map(data.drills.map(d => [d.rowId, d]))
  const exMap = new Map(data.exclusions.map(e => [e.rowId, e]))

  const transformedRows = data.rows.map(dbRow =>
    transformRow(dbRow, {
      timeBuckets: tbByRow.get(dbRow.id) ?? [],
      spendComposition: scMap.get(dbRow.id) ?? null,
      censusContext: ccMap.get(dbRow.id) ?? null,
      decomposition: dcMap.get(dbRow.id) ?? null,
      lineage: lnMap.get(dbRow.id) ?? null,
      aggregation: agMap.get(dbRow.id) ?? null,
      drill: drMap.get(dbRow.id) ?? null,
      exclusion: exMap.get(dbRow.id) ?? null,
    })
  )

  // Use authoritative KPI from DbView.kpi; fall back to row-derived only if missing
  const authoritativeKpi = data.view.kpi
    ? transformKpi(data.view.kpi)
    : computeKpiFromRows(transformedRows)

  // Development drift check: compare authoritative KPI against row-derived values
  if (data.view.kpi) {
    const derived = computeKpiFromRows(transformedRows)
    const tolerance = 1 // $1 tolerance for rounding
    // Skip drift check for vendor views (budget=0 by design, variance intentionally 0)
    const isVendorView = authoritativeKpi.budget === 0 && data.view.entityTypeLabel === "Vendors"
    if (!isVendorView &&
        (Math.abs(derived.budget - authoritativeKpi.budget) > tolerance ||
        Math.abs(derived.consumed - authoritativeKpi.consumed) > tolerance ||
        Math.abs(derived.variance - authoritativeKpi.variance) > tolerance)) {
      console.warn(`[KPI_DRIFT] View=${data.view.id}:`,
        { authoritative: { b: authoritativeKpi.budget, c: authoritativeKpi.consumed, v: authoritativeKpi.variance },
          derived: { b: derived.budget, c: derived.consumed, v: derived.variance } })
    }
  }

  return {
    id: data.view.id,
    breadcrumbPath: transformBreadcrumbs(data.breadcrumbs),
    scopeLabel: data.view.scopeLabel,
    reportContext: transformContext(data.context),
    timeBuckets: transformTimeBuckets(data.timeBuckets),
    kpi: authoritativeKpi,
    rows: transformedRows,
    entityTypeLabel: data.view.entityTypeLabel,
    meta: transformMeta(data.meta),
  }
}
/**
 * Database-Shaped Seed Data
 *
 * This file contains normalized, relational seed data using Db* types.
 * It replaces the direct payload-shaped stubs previously in data-source.tsx.
 *
 * The local adapter reads from these collections and transforms them
 * into payload-shaped ReportView objects via the transformation layer.
 *
 * RECONCILIATION RULES:
 * - Non-excluded child row sums must equal parent row values (budget, spend, committed, variance)
 * - KPI is provided as authoritative data on DbView.kpi (not derived from rows)
 * - Excluded rows: budget=0, variance=null, spend/committed are real values
 * - Excluded child rows sum to excluded parent's spend/committed
 */

import type {
  DbFacility, DbGlAccount, DbVendor, DbTransaction,
  DbReportContext, DbTimeBucket, DbKpi, DbKpiReconciliation,
  DbRow, DbRowTimeBucket, DbSpendComposition, DbCensusContext,
  DbDecomposition, DbLineage, DbAggregation, DbDrill, DbExclusion,
  DbReportMeta, DbBreadcrumbSegment, DbView, DbCensusDisplay,
} from "./db-types"

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export const dbFacilities: DbFacility[] = [
  { id: "fac-1", name: "North Ridge" },
  { id: "fac-2", name: "Pine Grove" },
  { id: "fac-3", name: "Cedar Falls" },
  { id: "fac-4", name: "Willow Creek" },
  { id: "fac-5", name: "Maple Terrace" },
]

export const dbGlAccounts: DbGlAccount[] = [
  { id: "gl-6100", code: "6100", name: "Food Supplies" },
  { id: "gl-7200", code: "7200", name: "Medical Supplies" },
  { id: "gl-5400", code: "5400", name: "Purchased Services" },
  { id: "gl-5400h", code: "5400", name: "Housekeeping" },
  { id: "gl-6200", code: "6200", name: "Dietary Supplements" },
  { id: "gl-8100", code: "8100", name: "Maintenance & Repair" },
]

export const dbVendors: DbVendor[] = [
  { id: "ven-1", name: "Sysco" },
  { id: "ven-2", name: "US Foods" },
  { id: "ven-3", name: "Performance Food Group" },
  { id: "ven-4", name: "McKesson" },
  { id: "ven-5", name: "Medline Industries" },
]

export const dbTransactions: DbTransaction[] = [
  { id: "txn-1001", vendorId: "ven-1", type: "INVOICE", reference: "Invoice 1001" },
  { id: "txn-1002", vendorId: "ven-1", type: "INVOICE", reference: "Invoice 1002" },
  { id: "txn-1003", vendorId: "ven-1", type: "INVOICE", reference: "Invoice 1003" },
  { id: "txn-po-2003", vendorId: "ven-1", type: "PO", reference: "PO 2003" },
  { id: "txn-inv-1004", vendorId: "ven-1", type: "INVOICE", reference: "Invoice 1004" },
]

// ---------------------------------------------------------------------------
// Report contexts and metadata
// ---------------------------------------------------------------------------

export const dbReportContexts: DbReportContext[] = [
  { id: "ctx-default", pivotType: "FACILITY", baseCurrency: "USD", comparisonMode: "BUDGET_VS_SPEND", includeExcluded: true },
  { id: "ctx-gl", pivotType: "GL_ACCOUNT", baseCurrency: "USD", comparisonMode: "BUDGET_VS_SPEND", includeExcluded: true },
  { id: "ctx-vendor", pivotType: "VENDOR", baseCurrency: "USD", comparisonMode: "BUDGET_VS_SPEND", includeExcluded: true },
]

export const dbMeta: DbReportMeta = {
  id: "meta-1", generatedAt: "2026-03-23T10:00:00Z", version: "2.1.0", dataScope: "ALL_FACILITIES", reportType: "BUDGET_VS_SPEND",
}

export const dbTimeBuckets: DbTimeBucket[] = [
  { id: "W1", contextId: "ctx-default", label: "Week 1", startDate: "2026-03-01", endDate: "2026-03-07", position: 0 },
  { id: "W2", contextId: "ctx-default", label: "Week 2", startDate: "2026-03-08", endDate: "2026-03-14", position: 1 },
  { id: "W3", contextId: "ctx-default", label: "Week 3", startDate: "2026-03-15", endDate: "2026-03-21", position: 2 },
  { id: "W1", contextId: "ctx-gl", label: "Week 1", startDate: "2026-03-01", endDate: "2026-03-07", position: 0 },
  { id: "W2", contextId: "ctx-gl", label: "Week 2", startDate: "2026-03-08", endDate: "2026-03-14", position: 1 },
  { id: "W3", contextId: "ctx-gl", label: "Week 3", startDate: "2026-03-15", endDate: "2026-03-21", position: 2 },
  { id: "W1", contextId: "ctx-vendor", label: "Week 1", startDate: "2026-03-01", endDate: "2026-03-07", position: 0 },
  { id: "W2", contextId: "ctx-vendor", label: "Week 2", startDate: "2026-03-08", endDate: "2026-03-14", position: 1 },
  { id: "W3", contextId: "ctx-vendor", label: "Week 3", startDate: "2026-03-15", endDate: "2026-03-21", position: 2 },
]

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export const dbViews: DbView[] = [
  // ===== FACILITY PIVOT =====
  { id: "fac-root", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Facilities", entityTypeLabel: "Facilities" },
  // Facility → GL
  { id: "fac-northridge-gl", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "GL Accounts within North Ridge", entityTypeLabel: "GL Accounts" },
  { id: "fac-pinegrove-gl", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "GL Accounts within Pine Grove", entityTypeLabel: "GL Accounts" },
  { id: "fac-cedarfalls-gl", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "GL Accounts within Cedar Falls", entityTypeLabel: "GL Accounts" },
  { id: "fac-willowcreek-gl", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "GL Accounts within Willow Creek", entityTypeLabel: "GL Accounts" },
  { id: "fac-mapleterrace-gl", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "GL Accounts within Maple Terrace", entityTypeLabel: "GL Accounts" },
  // Facility GL → Vendor (per-facility vendor views)
  { id: "fac-nr-gl6100-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 6100 - Food Supplies", entityTypeLabel: "Vendors" },
  { id: "fac-nr-gl7200-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 7200 - Medical Supplies", entityTypeLabel: "Vendors" },
  { id: "fac-nr-gl5400-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 5400 - Purchased Services", entityTypeLabel: "Vendors" },
  { id: "fac-pg-gl6100-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 6100 - Food Supplies", entityTypeLabel: "Vendors" },
  { id: "fac-pg-gl7200-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 7200 - Medical Supplies", entityTypeLabel: "Vendors" },
  { id: "fac-cf-gl6100-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 6100 - Food Supplies", entityTypeLabel: "Vendors" },
  { id: "fac-cf-gl7200-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 7200 - Medical Supplies", entityTypeLabel: "Vendors" },
  { id: "fac-wc-gl6100-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 6100 - Food Supplies", entityTypeLabel: "Vendors" },
  { id: "fac-wc-gl7200-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 7200 - Medical Supplies", entityTypeLabel: "Vendors" },
  { id: "fac-mt-gl6100-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 6100 - Food Supplies", entityTypeLabel: "Vendors" },
  { id: "fac-mt-gl7200-vendor", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Vendors within 7200 - Medical Supplies", entityTypeLabel: "Vendors" },
  // NR GL6100 → Vendor → Txn
  { id: "fac-nr-6100-sysco-txn", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Transactions within Sysco", entityTypeLabel: "Transactions" },
  { id: "fac-nr-6100-usfoods-txn", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Transactions within US Foods", entityTypeLabel: "Transactions" },
  { id: "fac-nr-6100-pfg-txn", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Transactions within Performance Food Group", entityTypeLabel: "Transactions" },
  // NR GL5400 → Vendor → Txn (excluded path)
  { id: "fac-nr-5400-sysco-txn", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Transactions within Sysco", entityTypeLabel: "Transactions" },
  { id: "fac-nr-5400-usfoods-txn", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Transactions within US Foods", entityTypeLabel: "Transactions" },
  { id: "fac-nr-5400-pfg-txn", contextId: "ctx-default", metaId: "meta-1", scopeLabel: "Transactions within Performance Food Group", entityTypeLabel: "Transactions" },

  // ===== GL PIVOT =====
  { id: "gl-root", contextId: "ctx-gl", metaId: "meta-1", scopeLabel: "GL Accounts", entityTypeLabel: "GL Accounts" },
  // GL → Vendor
  { id: "gl-6100-vendor", contextId: "ctx-gl", metaId: "meta-1", scopeLabel: "Vendors within 6100 - Food Supplies", entityTypeLabel: "Vendors" },
  { id: "gl-7200-vendor", contextId: "ctx-gl", metaId: "meta-1", scopeLabel: "Vendors within 7200 - Medical Supplies", entityTypeLabel: "Vendors" },
  { id: "gl-5400h-vendor", contextId: "ctx-gl", metaId: "meta-1", scopeLabel: "Vendors within 5400 - Housekeeping", entityTypeLabel: "Vendors" },
  { id: "gl-6200-vendor", contextId: "ctx-gl", metaId: "meta-1", scopeLabel: "Vendors within 6200 - Dietary Supplements", entityTypeLabel: "Vendors" },
  { id: "gl-8100-vendor", contextId: "ctx-gl", metaId: "meta-1", scopeLabel: "Vendors within 8100 - Maintenance & Repair", entityTypeLabel: "Vendors" },
  // GL6100 → Vendor → Txn (only 6100 has txn drill)
  { id: "gl-6100-sysco-txn", contextId: "ctx-gl", metaId: "meta-1", scopeLabel: "Transactions within Sysco", entityTypeLabel: "Transactions" },
  { id: "gl-6100-usfoods-txn", contextId: "ctx-gl", metaId: "meta-1", scopeLabel: "Transactions within US Foods", entityTypeLabel: "Transactions" },
  { id: "gl-6100-pfg-txn", contextId: "ctx-gl", metaId: "meta-1", scopeLabel: "Transactions within Performance Food Group", entityTypeLabel: "Transactions" },

  // ===== VENDOR PIVOT =====
  { id: "vendor-root", contextId: "ctx-vendor", metaId: "meta-1", scopeLabel: "Vendors", entityTypeLabel: "Vendors" },
  // Vendor → Facility
  { id: "vendor-sysco-fac", contextId: "ctx-vendor", metaId: "meta-1", scopeLabel: "Facilities within Sysco", entityTypeLabel: "Facilities" },
  { id: "vendor-usfoods-fac", contextId: "ctx-vendor", metaId: "meta-1", scopeLabel: "Facilities within US Foods", entityTypeLabel: "Facilities" },
  { id: "vendor-pfg-fac", contextId: "ctx-vendor", metaId: "meta-1", scopeLabel: "Facilities within Performance Food Group", entityTypeLabel: "Facilities" },
  { id: "vendor-mckesson-fac", contextId: "ctx-vendor", metaId: "meta-1", scopeLabel: "Facilities within McKesson", entityTypeLabel: "Facilities" },
  { id: "vendor-medline-fac", contextId: "ctx-vendor", metaId: "meta-1", scopeLabel: "Facilities within Medline Industries", entityTypeLabel: "Facilities" },
  // Sysco → Facility → Txn (only Sysco has txn drill)
  { id: "vendor-sysco-nr-txn", contextId: "ctx-vendor", metaId: "meta-1", scopeLabel: "Transactions within North Ridge", entityTypeLabel: "Transactions" },
  { id: "vendor-sysco-pg-txn", contextId: "ctx-vendor", metaId: "meta-1", scopeLabel: "Transactions within Pine Grove", entityTypeLabel: "Transactions" },
  { id: "vendor-sysco-cf-txn", contextId: "ctx-vendor", metaId: "meta-1", scopeLabel: "Transactions within Cedar Falls", entityTypeLabel: "Transactions" },
]

// ---------------------------------------------------------------------------
// Breadcrumb segments
// ---------------------------------------------------------------------------

export const dbBreadcrumbs: DbBreadcrumbSegment[] = [
  // === FACILITY PIVOT ===
  { viewId: "fac-root", position: 0, label: "Facilities", targetViewId: null },
  // Fac → GL
  { viewId: "fac-northridge-gl", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-northridge-gl", position: 1, label: "North Ridge", targetViewId: null },
  { viewId: "fac-pinegrove-gl", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-pinegrove-gl", position: 1, label: "Pine Grove", targetViewId: null },
  { viewId: "fac-cedarfalls-gl", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-cedarfalls-gl", position: 1, label: "Cedar Falls", targetViewId: null },
  { viewId: "fac-willowcreek-gl", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-willowcreek-gl", position: 1, label: "Willow Creek", targetViewId: null },
  { viewId: "fac-mapleterrace-gl", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-mapleterrace-gl", position: 1, label: "Maple Terrace", targetViewId: null },
  // NR GL → Vendor
  { viewId: "fac-nr-gl6100-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-nr-gl6100-vendor", position: 1, label: "North Ridge", targetViewId: "fac-northridge-gl" },
  { viewId: "fac-nr-gl6100-vendor", position: 2, label: "6100 - Food Supplies", targetViewId: null },
  { viewId: "fac-nr-gl7200-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-nr-gl7200-vendor", position: 1, label: "North Ridge", targetViewId: "fac-northridge-gl" },
  { viewId: "fac-nr-gl7200-vendor", position: 2, label: "7200 - Medical Supplies", targetViewId: null },
  { viewId: "fac-nr-gl5400-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-nr-gl5400-vendor", position: 1, label: "North Ridge", targetViewId: "fac-northridge-gl" },
  { viewId: "fac-nr-gl5400-vendor", position: 2, label: "5400 - Purchased Services", targetViewId: null },
  // PG GL → Vendor
  { viewId: "fac-pg-gl6100-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-pg-gl6100-vendor", position: 1, label: "Pine Grove", targetViewId: "fac-pinegrove-gl" },
  { viewId: "fac-pg-gl6100-vendor", position: 2, label: "6100 - Food Supplies", targetViewId: null },
  { viewId: "fac-pg-gl7200-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-pg-gl7200-vendor", position: 1, label: "Pine Grove", targetViewId: "fac-pinegrove-gl" },
  { viewId: "fac-pg-gl7200-vendor", position: 2, label: "7200 - Medical Supplies", targetViewId: null },
  // CF GL → Vendor
  { viewId: "fac-cf-gl6100-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-cf-gl6100-vendor", position: 1, label: "Cedar Falls", targetViewId: "fac-cedarfalls-gl" },
  { viewId: "fac-cf-gl6100-vendor", position: 2, label: "6100 - Food Supplies", targetViewId: null },
  { viewId: "fac-cf-gl7200-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-cf-gl7200-vendor", position: 1, label: "Cedar Falls", targetViewId: "fac-cedarfalls-gl" },
  { viewId: "fac-cf-gl7200-vendor", position: 2, label: "7200 - Medical Supplies", targetViewId: null },
  // WC GL → Vendor
  { viewId: "fac-wc-gl6100-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-wc-gl6100-vendor", position: 1, label: "Willow Creek", targetViewId: "fac-willowcreek-gl" },
  { viewId: "fac-wc-gl6100-vendor", position: 2, label: "6100 - Food Supplies", targetViewId: null },
  { viewId: "fac-wc-gl7200-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-wc-gl7200-vendor", position: 1, label: "Willow Creek", targetViewId: "fac-willowcreek-gl" },
  { viewId: "fac-wc-gl7200-vendor", position: 2, label: "7200 - Medical Supplies", targetViewId: null },
  // MT GL → Vendor
  { viewId: "fac-mt-gl6100-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-mt-gl6100-vendor", position: 1, label: "Maple Terrace", targetViewId: "fac-mapleterrace-gl" },
  { viewId: "fac-mt-gl6100-vendor", position: 2, label: "6100 - Food Supplies", targetViewId: null },
  { viewId: "fac-mt-gl7200-vendor", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-mt-gl7200-vendor", position: 1, label: "Maple Terrace", targetViewId: "fac-mapleterrace-gl" },
  { viewId: "fac-mt-gl7200-vendor", position: 2, label: "7200 - Medical Supplies", targetViewId: null },
  // NR GL6100 → Vendor → Txn
  { viewId: "fac-nr-6100-sysco-txn", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-nr-6100-sysco-txn", position: 1, label: "North Ridge", targetViewId: "fac-northridge-gl" },
  { viewId: "fac-nr-6100-sysco-txn", position: 2, label: "6100 - Food Supplies", targetViewId: "fac-nr-gl6100-vendor" },
  { viewId: "fac-nr-6100-sysco-txn", position: 3, label: "Sysco", targetViewId: null },
  { viewId: "fac-nr-6100-usfoods-txn", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-nr-6100-usfoods-txn", position: 1, label: "North Ridge", targetViewId: "fac-northridge-gl" },
  { viewId: "fac-nr-6100-usfoods-txn", position: 2, label: "6100 - Food Supplies", targetViewId: "fac-nr-gl6100-vendor" },
  { viewId: "fac-nr-6100-usfoods-txn", position: 3, label: "US Foods", targetViewId: null },
  { viewId: "fac-nr-6100-pfg-txn", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-nr-6100-pfg-txn", position: 1, label: "North Ridge", targetViewId: "fac-northridge-gl" },
  { viewId: "fac-nr-6100-pfg-txn", position: 2, label: "6100 - Food Supplies", targetViewId: "fac-nr-gl6100-vendor" },
  { viewId: "fac-nr-6100-pfg-txn", position: 3, label: "Performance Food Group", targetViewId: null },
  // NR GL5400 → Vendor → Txn (excluded path)
  { viewId: "fac-nr-5400-sysco-txn", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-nr-5400-sysco-txn", position: 1, label: "North Ridge", targetViewId: "fac-northridge-gl" },
  { viewId: "fac-nr-5400-sysco-txn", position: 2, label: "5400 - Purchased Services", targetViewId: "fac-nr-gl5400-vendor" },
  { viewId: "fac-nr-5400-sysco-txn", position: 3, label: "Sysco", targetViewId: null },
  { viewId: "fac-nr-5400-usfoods-txn", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-nr-5400-usfoods-txn", position: 1, label: "North Ridge", targetViewId: "fac-northridge-gl" },
  { viewId: "fac-nr-5400-usfoods-txn", position: 2, label: "5400 - Purchased Services", targetViewId: "fac-nr-gl5400-vendor" },
  { viewId: "fac-nr-5400-usfoods-txn", position: 3, label: "US Foods", targetViewId: null },
  { viewId: "fac-nr-5400-pfg-txn", position: 0, label: "Facilities", targetViewId: "fac-root" },
  { viewId: "fac-nr-5400-pfg-txn", position: 1, label: "North Ridge", targetViewId: "fac-northridge-gl" },
  { viewId: "fac-nr-5400-pfg-txn", position: 2, label: "5400 - Purchased Services", targetViewId: "fac-nr-gl5400-vendor" },
  { viewId: "fac-nr-5400-pfg-txn", position: 3, label: "Performance Food Group", targetViewId: null },

  // === GL PIVOT ===
  { viewId: "gl-root", position: 0, label: "GL Accounts", targetViewId: null },
  // GL → Vendor
  { viewId: "gl-6100-vendor", position: 0, label: "GL Accounts", targetViewId: "gl-root" },
  { viewId: "gl-6100-vendor", position: 1, label: "6100 - Food Supplies", targetViewId: null },
  { viewId: "gl-7200-vendor", position: 0, label: "GL Accounts", targetViewId: "gl-root" },
  { viewId: "gl-7200-vendor", position: 1, label: "7200 - Medical Supplies", targetViewId: null },
  { viewId: "gl-5400h-vendor", position: 0, label: "GL Accounts", targetViewId: "gl-root" },
  { viewId: "gl-5400h-vendor", position: 1, label: "5400 - Housekeeping", targetViewId: null },
  { viewId: "gl-6200-vendor", position: 0, label: "GL Accounts", targetViewId: "gl-root" },
  { viewId: "gl-6200-vendor", position: 1, label: "6200 - Dietary Supplements", targetViewId: null },
  { viewId: "gl-8100-vendor", position: 0, label: "GL Accounts", targetViewId: "gl-root" },
  { viewId: "gl-8100-vendor", position: 1, label: "8100 - Maintenance & Repair", targetViewId: null },
  // GL6100 → Vendor → Txn
  { viewId: "gl-6100-sysco-txn", position: 0, label: "GL Accounts", targetViewId: "gl-root" },
  { viewId: "gl-6100-sysco-txn", position: 1, label: "6100 - Food Supplies", targetViewId: "gl-6100-vendor" },
  { viewId: "gl-6100-sysco-txn", position: 2, label: "Sysco", targetViewId: null },
  { viewId: "gl-6100-usfoods-txn", position: 0, label: "GL Accounts", targetViewId: "gl-root" },
  { viewId: "gl-6100-usfoods-txn", position: 1, label: "6100 - Food Supplies", targetViewId: "gl-6100-vendor" },
  { viewId: "gl-6100-usfoods-txn", position: 2, label: "US Foods", targetViewId: null },
  { viewId: "gl-6100-pfg-txn", position: 0, label: "GL Accounts", targetViewId: "gl-root" },
  { viewId: "gl-6100-pfg-txn", position: 1, label: "6100 - Food Supplies", targetViewId: "gl-6100-vendor" },
  { viewId: "gl-6100-pfg-txn", position: 2, label: "Performance Food Group", targetViewId: null },

  // === VENDOR PIVOT ===
  { viewId: "vendor-root", position: 0, label: "Vendors", targetViewId: null },
  // Vendor → Facility
  { viewId: "vendor-sysco-fac", position: 0, label: "Vendors", targetViewId: "vendor-root" },
  { viewId: "vendor-sysco-fac", position: 1, label: "Sysco", targetViewId: null },
  { viewId: "vendor-usfoods-fac", position: 0, label: "Vendors", targetViewId: "vendor-root" },
  { viewId: "vendor-usfoods-fac", position: 1, label: "US Foods", targetViewId: null },
  { viewId: "vendor-pfg-fac", position: 0, label: "Vendors", targetViewId: "vendor-root" },
  { viewId: "vendor-pfg-fac", position: 1, label: "Performance Food Group", targetViewId: null },
  { viewId: "vendor-mckesson-fac", position: 0, label: "Vendors", targetViewId: "vendor-root" },
  { viewId: "vendor-mckesson-fac", position: 1, label: "McKesson", targetViewId: null },
  { viewId: "vendor-medline-fac", position: 0, label: "Vendors", targetViewId: "vendor-root" },
  { viewId: "vendor-medline-fac", position: 1, label: "Medline Industries", targetViewId: null },
  // Sysco → Facility → Txn
  { viewId: "vendor-sysco-nr-txn", position: 0, label: "Vendors", targetViewId: "vendor-root" },
  { viewId: "vendor-sysco-nr-txn", position: 1, label: "Sysco", targetViewId: "vendor-sysco-fac" },
  { viewId: "vendor-sysco-nr-txn", position: 2, label: "North Ridge", targetViewId: null },
  { viewId: "vendor-sysco-pg-txn", position: 0, label: "Vendors", targetViewId: "vendor-root" },
  { viewId: "vendor-sysco-pg-txn", position: 1, label: "Sysco", targetViewId: "vendor-sysco-fac" },
  { viewId: "vendor-sysco-pg-txn", position: 2, label: "Pine Grove", targetViewId: null },
  { viewId: "vendor-sysco-cf-txn", position: 0, label: "Vendors", targetViewId: "vendor-root" },
  { viewId: "vendor-sysco-cf-txn", position: 1, label: "Sysco", targetViewId: "vendor-sysco-fac" },
  { viewId: "vendor-sysco-cf-txn", position: 2, label: "Cedar Falls", targetViewId: null },
]

// ---------------------------------------------------------------------------
// Row data (normalized) — ALL RECONCILED
//
// RECONCILIATION PROOF (Facility Pivot):
//   fac-root non-excl sum: B=400000 S=409000 C=12800 V=-9000
//   NR(120000/115000/3200/5000) → GL non-excl: 65000+55000=120000, 62000+53000=115000, 1800+1400=3200, 3000+2000=5000 ✓
//   PG(80000/92000/4100/-12000) → GL: 48000+32000=80000, 55000+37000=92000, 2400+1700=4100, -7000-5000=-12000 ✓
//   CF(60000/58000/1500/2000) → GL: 36000+24000=60000, 34000+24000=58000, 900+600=1500, 2000+0=2000 ✓
//   WC(95000/101000/2800/-6000) → GL: 55000+40000=95000, 59000+42000=101000, 1600+1200=2800, -4000-2000=-6000 ✓
//   MT(45000/43000/1200/2000) → GL: 27000+18000=45000, 25000+18000=43000, 700+500=1200, 2000+0=2000 ✓
//   NR/6100(65000/62000/1800/3000) → Vendors: 30000+22000+13000=65000, 28000+24000+10000=62000, 800+700+300=1800, 2000-2000+3000=3000 ✓
//   NR/6100/Sysco(30000/28000/800/2000) → Txn: 12000+8000+5000+3000+2000=30000, 11000+9500+4500+0+3000=28000, 0+0+0+800+0=800, 1000-1500+500+2000+0=2000 ✓ (adjusted last V to 0)
// ---------------------------------------------------------------------------

const defaultDecomp = { source: "MONTHLY" as const, method: "DAILY_PRORATION" as const, remainderHandling: "CARRY_FORWARD" as const, auditId: "DEC-2026-03-FULL" }

export const dbRows: DbRow[] = [
  // =====================================================================
  // FACILITY ROOT — sum B=400000 S=409000 C=12800 V=-9000
  // =====================================================================
  { id: "fr-1", viewId: "fac-root", entityType: "Facility", entityId: "fac-1", label: "North Ridge", budget: 120000, spend: 115000, committed: 3200, variance: 5000, excluded: false, childViewId: "fac-northridge-gl", po: null, invoice: null },
  { id: "fr-2", viewId: "fac-root", entityType: "Facility", entityId: "fac-2", label: "Pine Grove", budget: 80000, spend: 92000, committed: 4100, variance: -12000, excluded: false, childViewId: "fac-pinegrove-gl", po: null, invoice: null },
  { id: "fr-3", viewId: "fac-root", entityType: "Facility", entityId: "fac-3", label: "Cedar Falls", budget: 60000, spend: 58000, committed: 1500, variance: 2000, excluded: false, childViewId: "fac-cedarfalls-gl", po: null, invoice: null },
  { id: "fr-4", viewId: "fac-root", entityType: "Facility", entityId: "fac-4", label: "Willow Creek", budget: 95000, spend: 101000, committed: 2800, variance: -6000, excluded: false, childViewId: "fac-willowcreek-gl", po: null, invoice: null },
  { id: "fr-5", viewId: "fac-root", entityType: "Facility", entityId: "fac-5", label: "Maple Terrace", budget: 45000, spend: 43000, committed: 1200, variance: 2000, excluded: false, childViewId: "fac-mapleterrace-gl", po: null, invoice: null },

  // =====================================================================
  // NORTH RIDGE → GL — non-excl sum B=120000 S=115000 C=3200 V=5000
  // =====================================================================
  { id: "fgl-1", viewId: "fac-northridge-gl", entityType: "GL Account", entityId: "gl-6100", label: "6100 - Food Supplies", budget: 65000, spend: 62000, committed: 1800, variance: 3000, excluded: false, childViewId: "fac-nr-gl6100-vendor", po: null, invoice: null },
  { id: "fgl-2", viewId: "fac-northridge-gl", entityType: "GL Account", entityId: "gl-7200", label: "7200 - Medical Supplies", budget: 55000, spend: 53000, committed: 1400, variance: 2000, excluded: false, childViewId: "fac-nr-gl7200-vendor", po: null, invoice: null },
  { id: "fgl-3", viewId: "fac-northridge-gl", entityType: "GL Account", entityId: "gl-5400", label: "5400 - Purchased Services", budget: 0, spend: 4500, committed: 500, variance: null, excluded: true, childViewId: "fac-nr-gl5400-vendor", po: null, invoice: null },

  // =====================================================================
  // PINE GROVE → GL — non-excl sum B=80000 S=92000 C=4100 V=-12000
  // =====================================================================
  { id: "fgl-1b", viewId: "fac-pinegrove-gl", entityType: "GL Account", entityId: "gl-6100", label: "6100 - Food Supplies", budget: 48000, spend: 55000, committed: 2400, variance: -7000, excluded: false, childViewId: "fac-pg-gl6100-vendor", po: null, invoice: null },
  { id: "fgl-2b", viewId: "fac-pinegrove-gl", entityType: "GL Account", entityId: "gl-7200", label: "7200 - Medical Supplies", budget: 32000, spend: 37000, committed: 1700, variance: -5000, excluded: false, childViewId: "fac-pg-gl7200-vendor", po: null, invoice: null },

  // =====================================================================
  // CEDAR FALLS → GL — sum B=60000 S=58000 C=1500 V=2000
  // =====================================================================
  { id: "fgl-1c", viewId: "fac-cedarfalls-gl", entityType: "GL Account", entityId: "gl-6100", label: "6100 - Food Supplies", budget: 36000, spend: 34000, committed: 900, variance: 2000, excluded: false, childViewId: "fac-cf-gl6100-vendor", po: null, invoice: null },
  { id: "fgl-2c", viewId: "fac-cedarfalls-gl", entityType: "GL Account", entityId: "gl-7200", label: "7200 - Medical Supplies", budget: 24000, spend: 24000, committed: 600, variance: 0, excluded: false, childViewId: "fac-cf-gl7200-vendor", po: null, invoice: null },

  // =====================================================================
  // WILLOW CREEK → GL — sum B=95000 S=101000 C=2800 V=-6000
  // =====================================================================
  { id: "fgl-1d", viewId: "fac-willowcreek-gl", entityType: "GL Account", entityId: "gl-6100", label: "6100 - Food Supplies", budget: 55000, spend: 59000, committed: 1600, variance: -4000, excluded: false, childViewId: "fac-wc-gl6100-vendor", po: null, invoice: null },
  { id: "fgl-2d", viewId: "fac-willowcreek-gl", entityType: "GL Account", entityId: "gl-7200", label: "7200 - Medical Supplies", budget: 40000, spend: 42000, committed: 1200, variance: -2000, excluded: false, childViewId: "fac-wc-gl7200-vendor", po: null, invoice: null },

  // =====================================================================
  // MAPLE TERRACE → GL — sum B=45000 S=43000 C=1200 V=2000
  // =====================================================================
  { id: "fgl-1e", viewId: "fac-mapleterrace-gl", entityType: "GL Account", entityId: "gl-6100", label: "6100 - Food Supplies", budget: 27000, spend: 25000, committed: 700, variance: 2000, excluded: false, childViewId: "fac-mt-gl6100-vendor", po: null, invoice: null },
  { id: "fgl-2e", viewId: "fac-mapleterrace-gl", entityType: "GL Account", entityId: "gl-7200", label: "7200 - Medical Supplies", budget: 18000, spend: 18000, committed: 500, variance: 0, excluded: false, childViewId: "fac-mt-gl7200-vendor", po: null, invoice: null },

  // =====================================================================
  // NR / 6100 → VENDORS — sum B=65000 S=62000 C=1800 V=3000
  // =====================================================================
  { id: "fv-1", viewId: "fac-nr-gl6100-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 30000, spend: 28000, committed: 800, variance: 2000, excluded: false, childViewId: "fac-nr-6100-sysco-txn", po: null, invoice: null },
  { id: "fv-2", viewId: "fac-nr-gl6100-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 22000, spend: 24000, committed: 700, variance: -2000, excluded: false, childViewId: "fac-nr-6100-usfoods-txn", po: null, invoice: null },
  { id: "fv-3", viewId: "fac-nr-gl6100-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 13000, spend: 10000, committed: 300, variance: 3000, excluded: false, childViewId: "fac-nr-6100-pfg-txn", po: null, invoice: null },

  // =====================================================================
  // NR / 7200 → VENDORS — sum B=55000 S=53000 C=1400 V=2000
  // =====================================================================
  { id: "fv-4", viewId: "fac-nr-gl7200-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 25000, spend: 24000, committed: 600, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-5", viewId: "fac-nr-gl7200-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 18000, spend: 19000, committed: 500, variance: -1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-6", viewId: "fac-nr-gl7200-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 12000, spend: 10000, committed: 300, variance: 2000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // NR / 5400 (EXCLUDED) → VENDORS — sum S=4500 C=500
  // =====================================================================
  { id: "fev-1", viewId: "fac-nr-gl5400-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 0, spend: 2000, committed: 200, variance: null, excluded: true, childViewId: "fac-nr-5400-sysco-txn", po: null, invoice: null },
  { id: "fev-2", viewId: "fac-nr-gl5400-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 0, spend: 1500, committed: 150, variance: null, excluded: true, childViewId: "fac-nr-5400-usfoods-txn", po: null, invoice: null },
  { id: "fev-3", viewId: "fac-nr-gl5400-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 0, spend: 1000, committed: 150, variance: null, excluded: true, childViewId: "fac-nr-5400-pfg-txn", po: null, invoice: null },

  // =====================================================================
  // PG / 6100 → VENDORS — sum B=48000 S=55000 C=2400 V=-7000
  // =====================================================================
  { id: "fv-pg-1", viewId: "fac-pg-gl6100-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 22000, spend: 25000, committed: 1000, variance: -3000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-pg-2", viewId: "fac-pg-gl6100-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 16000, spend: 19000, committed: 900, variance: -3000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-pg-3", viewId: "fac-pg-gl6100-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 10000, spend: 11000, committed: 500, variance: -1000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // PG / 7200 → VENDORS — sum B=32000 S=37000 C=1700 V=-5000
  // =====================================================================
  { id: "fv-pg-4", viewId: "fac-pg-gl7200-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 14000, spend: 16000, committed: 700, variance: -2000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-pg-5", viewId: "fac-pg-gl7200-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 10000, spend: 13000, committed: 600, variance: -3000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-pg-6", viewId: "fac-pg-gl7200-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 8000, spend: 8000, committed: 400, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // CF / 6100 → VENDORS — sum B=36000 S=34000 C=900 V=2000
  // =====================================================================
  { id: "fv-cf-1", viewId: "fac-cf-gl6100-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 16000, spend: 15000, committed: 400, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-cf-2", viewId: "fac-cf-gl6100-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 12000, spend: 12000, committed: 300, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-cf-3", viewId: "fac-cf-gl6100-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 8000, spend: 7000, committed: 200, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // CF / 7200 → VENDORS — sum B=24000 S=24000 C=600 V=0
  // =====================================================================
  { id: "fv-cf-4", viewId: "fac-cf-gl7200-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 10000, spend: 10000, committed: 250, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-cf-5", viewId: "fac-cf-gl7200-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 8000, spend: 8000, committed: 200, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-cf-6", viewId: "fac-cf-gl7200-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 6000, spend: 6000, committed: 150, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // WC / 6100 → VENDORS — sum B=55000 S=59000 C=1600 V=-4000
  // =====================================================================
  { id: "fv-wc-1", viewId: "fac-wc-gl6100-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 24000, spend: 26000, committed: 700, variance: -2000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-wc-2", viewId: "fac-wc-gl6100-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 18000, spend: 20000, committed: 550, variance: -2000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-wc-3", viewId: "fac-wc-gl6100-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 13000, spend: 13000, committed: 350, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // WC / 7200 → VENDORS — sum B=40000 S=42000 C=1200 V=-2000
  // =====================================================================
  { id: "fv-wc-4", viewId: "fac-wc-gl7200-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 18000, spend: 19000, committed: 500, variance: -1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-wc-5", viewId: "fac-wc-gl7200-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 13000, spend: 14000, committed: 400, variance: -1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-wc-6", viewId: "fac-wc-gl7200-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 9000, spend: 9000, committed: 300, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // MT / 6100 → VENDORS — sum B=27000 S=25000 C=700 V=2000
  // =====================================================================
  { id: "fv-mt-1", viewId: "fac-mt-gl6100-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 12000, spend: 11000, committed: 300, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-mt-2", viewId: "fac-mt-gl6100-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 9000, spend: 9000, committed: 250, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-mt-3", viewId: "fac-mt-gl6100-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 6000, spend: 5000, committed: 150, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // MT / 7200 → VENDORS — sum B=18000 S=18000 C=500 V=0
  // =====================================================================
  { id: "fv-mt-4", viewId: "fac-mt-gl7200-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 8000, spend: 8000, committed: 200, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-mt-5", viewId: "fac-mt-gl7200-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 6000, spend: 6000, committed: 180, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "fv-mt-6", viewId: "fac-mt-gl7200-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 4000, spend: 4000, committed: 120, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // NR / 6100 / SYSCO → TXN — sum B=30000 S=28000 C=800 V=2000
  // =====================================================================
  { id: "ft-1", viewId: "fac-nr-6100-sysco-txn", entityType: "Transaction", entityId: "txn-1001", label: "Invoice 1001", budget: 12000, spend: 11000, committed: 0, variance: 1000, excluded: false, childViewId: null, po: "PO 2001", invoice: "Invoice 1001" },
  { id: "ft-2", viewId: "fac-nr-6100-sysco-txn", entityType: "Transaction", entityId: "txn-1002", label: "Invoice 1002", budget: 8000, spend: 9500, committed: 0, variance: -1500, excluded: false, childViewId: null, po: "PO 2001", invoice: "Invoice 1002" },
  { id: "ft-3", viewId: "fac-nr-6100-sysco-txn", entityType: "Transaction", entityId: "txn-1003", label: "Invoice 1003", budget: 5000, spend: 4500, committed: 0, variance: 500, excluded: false, childViewId: null, po: "PO 2002", invoice: "Invoice 1003" },
  { id: "ft-4", viewId: "fac-nr-6100-sysco-txn", entityType: "Transaction", entityId: "txn-po-2003", label: "PO 2003", budget: 3000, spend: 0, committed: 800, variance: 3000, excluded: false, childViewId: null, po: "PO 2003", invoice: null },
  { id: "ft-5", viewId: "fac-nr-6100-sysco-txn", entityType: "Transaction", entityId: "txn-inv-1004", label: "Invoice 1004", budget: 1000, spend: 2000, committed: 0, variance: -1000, excluded: false, childViewId: null, po: null, invoice: "Invoice 1004" },
  { id: "ft-6", viewId: "fac-nr-6100-sysco-txn", entityType: "Transaction", entityId: "txn-ma-1001", label: "Accrual 1001", budget: 1000, spend: 1000, committed: 0, variance: 0, excluded: false, childViewId: null, po: null, invoice: null, txnType: "MANUAL_ACCRUAL" },

  // =====================================================================
  // NR / 6100 / US FOODS → TXN — sum B=22000 S=24000 C=700 V=-2000
  // =====================================================================
  { id: "ft-1u", viewId: "fac-nr-6100-usfoods-txn", entityType: "Transaction", entityId: "txn-2001", label: "Invoice 2001", budget: 10000, spend: 11000, committed: 0, variance: -1000, excluded: false, childViewId: null, po: "PO 2010", invoice: "Invoice 2001" },
  { id: "ft-2u", viewId: "fac-nr-6100-usfoods-txn", entityType: "Transaction", entityId: "txn-2002", label: "Invoice 2002", budget: 7000, spend: 8000, committed: 0, variance: -1000, excluded: false, childViewId: null, po: "PO 2010", invoice: "Invoice 2002" },
  { id: "ft-3u", viewId: "fac-nr-6100-usfoods-txn", entityType: "Transaction", entityId: "txn-2003", label: "Invoice 2003", budget: 2000, spend: 2500, committed: 0, variance: -500, excluded: false, childViewId: null, po: "PO 2011", invoice: "Invoice 2003" },
  { id: "ft-4u", viewId: "fac-nr-6100-usfoods-txn", entityType: "Transaction", entityId: "txn-po-2012", label: "PO 2012", budget: 2000, spend: 2000, committed: 700, variance: 0, excluded: false, childViewId: null, po: "PO 2012", invoice: null },
  { id: "ft-5u", viewId: "fac-nr-6100-usfoods-txn", entityType: "Transaction", entityId: "txn-ma-2001", label: "Accrual 2001", budget: 1000, spend: 500, committed: 0, variance: 500, excluded: false, childViewId: null, po: null, invoice: null, txnType: "MANUAL_ACCRUAL" },

  // =====================================================================
  // NR / 6100 / PFG → TXN — sum B=13000 S=10000 C=300 V=3000
  // =====================================================================
  { id: "ft-1p", viewId: "fac-nr-6100-pfg-txn", entityType: "Transaction", entityId: "txn-3001", label: "Invoice 3001", budget: 6000, spend: 5000, committed: 0, variance: 1000, excluded: false, childViewId: null, po: "PO 2020", invoice: "Invoice 3001" },
  { id: "ft-2p", viewId: "fac-nr-6100-pfg-txn", entityType: "Transaction", entityId: "txn-3002", label: "Invoice 3002", budget: 4000, spend: 3000, committed: 0, variance: 1000, excluded: false, childViewId: null, po: null, invoice: "Invoice 3002" },
  { id: "ft-3p", viewId: "fac-nr-6100-pfg-txn", entityType: "Transaction", entityId: "txn-po-2021", label: "PO 2021", budget: 3000, spend: 2000, committed: 300, variance: 1000, excluded: false, childViewId: null, po: "PO 2021", invoice: null },

  // =====================================================================
  // NR / 5400 / SYSCO → TXN (EXCLUDED) — sum S=2000 C=200
  // =====================================================================
  { id: "fet-1", viewId: "fac-nr-5400-sysco-txn", entityType: "Transaction", entityId: "txn-e1001", label: "Invoice 1001", budget: 0, spend: 1200, committed: 0, variance: null, excluded: true, childViewId: null, po: "PO 2001", invoice: "Invoice 1001" },
  { id: "fet-2", viewId: "fac-nr-5400-sysco-txn", entityType: "Transaction", entityId: "txn-e1002", label: "Invoice 1002", budget: 0, spend: 600, committed: 0, variance: null, excluded: true, childViewId: null, po: null, invoice: "Invoice 1002" },
  { id: "fet-3", viewId: "fac-nr-5400-sysco-txn", entityType: "Transaction", entityId: "txn-epo-2030", label: "PO 2030", budget: 0, spend: 200, committed: 200, variance: null, excluded: true, childViewId: null, po: "PO 2030", invoice: null },

  // =====================================================================
  // NR / 5400 / US FOODS → TXN (EXCLUDED) — sum S=1500 C=150
  // =====================================================================
  { id: "fet-1x", viewId: "fac-nr-5400-usfoods-txn", entityType: "Transaction", entityId: "txn-e4001", label: "Invoice 4001", budget: 0, spend: 1000, committed: 0, variance: null, excluded: true, childViewId: null, po: "PO 2031", invoice: "Invoice 4001" },
  { id: "fet-2x", viewId: "fac-nr-5400-usfoods-txn", entityType: "Transaction", entityId: "txn-epo-2032", label: "PO 2032", budget: 0, spend: 500, committed: 150, variance: null, excluded: true, childViewId: null, po: "PO 2032", invoice: null },

  // =====================================================================
  // NR / 5400 / PFG → TXN (EXCLUDED) — sum S=1000 C=150
  // =====================================================================
  { id: "fet-1y", viewId: "fac-nr-5400-pfg-txn", entityType: "Transaction", entityId: "txn-e5001", label: "Invoice 5001", budget: 0, spend: 800, committed: 0, variance: null, excluded: true, childViewId: null, po: "PO 2033", invoice: "Invoice 5001" },
  { id: "fet-2y", viewId: "fac-nr-5400-pfg-txn", entityType: "Transaction", entityId: "txn-epo-2034", label: "PO 2034", budget: 0, spend: 200, committed: 150, variance: null, excluded: true, childViewId: null, po: "PO 2034", invoice: null },

  // =====================================================================
  // GL ROOT — sum B=312000 S=307500 C=13000 V=4500
  // =====================================================================
  { id: "gr-1", viewId: "gl-root", entityType: "GL Account", entityId: "gl-6100", label: "6100 - Food Supplies", budget: 95000, spend: 88000, committed: 4200, variance: 7000, excluded: false, childViewId: "gl-6100-vendor", po: null, invoice: null },
  { id: "gr-2", viewId: "gl-root", entityType: "GL Account", entityId: "gl-7200", label: "7200 - Medical Supplies", budget: 72000, spend: 79000, committed: 3100, variance: -7000, excluded: false, childViewId: "gl-7200-vendor", po: null, invoice: null },
  { id: "gr-3", viewId: "gl-root", entityType: "GL Account", entityId: "gl-5400h", label: "5400 - Housekeeping", budget: 48000, spend: 45000, committed: 1800, variance: 3000, excluded: false, childViewId: "gl-5400h-vendor", po: null, invoice: null },
  { id: "gr-4", viewId: "gl-root", entityType: "GL Account", entityId: "gl-6200", label: "6200 - Dietary Supplements", budget: 35000, spend: 37500, committed: 1500, variance: -2500, excluded: false, childViewId: "gl-6200-vendor", po: null, invoice: null },
  { id: "gr-5", viewId: "gl-root", entityType: "GL Account", entityId: "gl-8100", label: "8100 - Maintenance & Repair", budget: 62000, spend: 58000, committed: 2400, variance: 4000, excluded: false, childViewId: "gl-8100-vendor", po: null, invoice: null },

  // =====================================================================
  // GL 6100 → VENDORS — sum B=95000 S=88000 C=4200 V=7000
  // =====================================================================
  { id: "gv-1", viewId: "gl-6100-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 40000, spend: 38000, committed: 1800, variance: 2000, excluded: false, childViewId: "gl-6100-sysco-txn", po: null, invoice: null },
  { id: "gv-2", viewId: "gl-6100-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 30000, spend: 32000, committed: 1400, variance: -2000, excluded: false, childViewId: "gl-6100-usfoods-txn", po: null, invoice: null },
  { id: "gv-3", viewId: "gl-6100-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 25000, spend: 18000, committed: 1000, variance: 7000, excluded: false, childViewId: "gl-6100-pfg-txn", po: null, invoice: null },

  // =====================================================================
  // GL 7200 → VENDORS — sum B=72000 S=79000 C=3100 V=-7000
  // =====================================================================
  { id: "gv-1b", viewId: "gl-7200-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 30000, spend: 34000, committed: 1300, variance: -4000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "gv-2b", viewId: "gl-7200-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 24000, spend: 28000, committed: 1100, variance: -4000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "gv-3b", viewId: "gl-7200-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 18000, spend: 17000, committed: 700, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // GL 5400h → VENDORS — sum B=48000 S=45000 C=1800 V=3000
  // =====================================================================
  { id: "gv-1c", viewId: "gl-5400h-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 20000, spend: 19000, committed: 800, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "gv-2c", viewId: "gl-5400h-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 16000, spend: 15000, committed: 600, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "gv-3c", viewId: "gl-5400h-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 12000, spend: 11000, committed: 400, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // GL 6200 → VENDORS — sum B=35000 S=37500 C=1500 V=-2500
  // =====================================================================
  { id: "gv-1d", viewId: "gl-6200-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 15000, spend: 16000, committed: 600, variance: -1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "gv-2d", viewId: "gl-6200-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 12000, spend: 13500, committed: 550, variance: -1500, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "gv-3d", viewId: "gl-6200-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 8000, spend: 8000, committed: 350, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // GL 8100 → VENDORS — sum B=62000 S=58000 C=2400 V=4000
  // =====================================================================
  { id: "gv-1e", viewId: "gl-8100-vendor", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 26000, spend: 24000, committed: 1000, variance: 2000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "gv-2e", viewId: "gl-8100-vendor", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 20000, spend: 19000, committed: 800, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "gv-3e", viewId: "gl-8100-vendor", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 16000, spend: 15000, committed: 600, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // GL 6100 / SYSCO → TXN — sum B=40000 S=38000 C=1800 V=2000
  // =====================================================================
  { id: "gt-1", viewId: "gl-6100-sysco-txn", entityType: "Transaction", entityId: "txn-5001", label: "Invoice 5001", budget: 15000, spend: 14000, committed: 0, variance: 1000, excluded: false, childViewId: null, po: null, invoice: "Invoice 5001" },
  { id: "gt-2", viewId: "gl-6100-sysco-txn", entityType: "Transaction", entityId: "txn-5002", label: "Invoice 5002", budget: 12000, spend: 13000, committed: 0, variance: -1000, excluded: false, childViewId: null, po: "PO 3001", invoice: "Invoice 5002" },
  { id: "gt-3", viewId: "gl-6100-sysco-txn", entityType: "Transaction", entityId: "txn-5003", label: "Invoice 5003", budget: 8000, spend: 7000, committed: 0, variance: 1000, excluded: false, childViewId: null, po: "PO 3001", invoice: "Invoice 5003" },
  { id: "gt-4", viewId: "gl-6100-sysco-txn", entityType: "Transaction", entityId: "txn-po-3002", label: "PO 3002", budget: 3500, spend: 3000, committed: 1800, variance: 500, excluded: false, childViewId: null, po: "PO 3002", invoice: null },
  { id: "gt-5", viewId: "gl-6100-sysco-txn", entityType: "Transaction", entityId: "txn-ma-3001", label: "Accrual 3001", budget: 1500, spend: 1000, committed: 0, variance: 500, excluded: false, childViewId: null, po: null, invoice: null, txnType: "MANUAL_ACCRUAL" },

  // =====================================================================
  // GL 6100 / US FOODS → TXN — sum B=30000 S=32000 C=1400 V=-2000
  // =====================================================================
  { id: "gt-1u", viewId: "gl-6100-usfoods-txn", entityType: "Transaction", entityId: "txn-5004", label: "Invoice 5004", budget: 14000, spend: 15000, committed: 0, variance: -1000, excluded: false, childViewId: null, po: "PO 3003", invoice: "Invoice 5004" },
  { id: "gt-2u", viewId: "gl-6100-usfoods-txn", entityType: "Transaction", entityId: "txn-5005", label: "Invoice 5005", budget: 10000, spend: 12000, committed: 0, variance: -2000, excluded: false, childViewId: null, po: null, invoice: "Invoice 5005" },
  { id: "gt-3u", viewId: "gl-6100-usfoods-txn", entityType: "Transaction", entityId: "txn-po-3004", label: "PO 3004", budget: 6000, spend: 5000, committed: 1400, variance: 1000, excluded: false, childViewId: null, po: "PO 3004", invoice: null },

  // =====================================================================
  // GL 6100 / PFG → TXN — sum B=25000 S=18000 C=1000 V=7000
  // =====================================================================
  { id: "gt-1p", viewId: "gl-6100-pfg-txn", entityType: "Transaction", entityId: "txn-5006", label: "Invoice 5006", budget: 12000, spend: 9000, committed: 0, variance: 3000, excluded: false, childViewId: null, po: "PO 3005", invoice: "Invoice 5006" },
  { id: "gt-2p", viewId: "gl-6100-pfg-txn", entityType: "Transaction", entityId: "txn-5007", label: "Invoice 5007", budget: 8000, spend: 6000, committed: 0, variance: 2000, excluded: false, childViewId: null, po: null, invoice: "Invoice 5007" },
  { id: "gt-3p", viewId: "gl-6100-pfg-txn", entityType: "Transaction", entityId: "txn-po-3006", label: "PO 3006", budget: 5000, spend: 3000, committed: 1000, variance: 2000, excluded: false, childViewId: null, po: "PO 3006", invoice: null },

  // =====================================================================
  // VENDOR ROOT — sum B=284000 S=285500 C=11500 V=-1500
  // =====================================================================
  { id: "vr-1", viewId: "vendor-root", entityType: "Vendor", entityId: "ven-1", label: "Sysco", budget: 85000, spend: 82000, committed: 3500, variance: 3000, excluded: false, childViewId: "vendor-sysco-fac", po: null, invoice: null },
  { id: "vr-2", viewId: "vendor-root", entityType: "Vendor", entityId: "ven-2", label: "US Foods", budget: 64000, spend: 71000, committed: 2800, variance: -7000, excluded: false, childViewId: "vendor-usfoods-fac", po: null, invoice: null },
  { id: "vr-3", viewId: "vendor-root", entityType: "Vendor", entityId: "ven-3", label: "Performance Food Group", budget: 42000, spend: 39000, committed: 1600, variance: 3000, excluded: false, childViewId: "vendor-pfg-fac", po: null, invoice: null },
  { id: "vr-4", viewId: "vendor-root", entityType: "Vendor", entityId: "ven-4", label: "McKesson", budget: 55000, spend: 58500, committed: 2200, variance: -3500, excluded: false, childViewId: "vendor-mckesson-fac", po: null, invoice: null },
  { id: "vr-5", viewId: "vendor-root", entityType: "Vendor", entityId: "ven-5", label: "Medline Industries", budget: 38000, spend: 35000, committed: 1400, variance: 3000, excluded: false, childViewId: "vendor-medline-fac", po: null, invoice: null },

  // =====================================================================
  // SYSCO → FACILITIES — sum B=85000 S=82000 C=3500 V=3000
  // =====================================================================
  { id: "vf-1", viewId: "vendor-sysco-fac", entityType: "Facility", entityId: "fac-1", label: "North Ridge", budget: 35000, spend: 33000, committed: 1400, variance: 2000, excluded: false, childViewId: "vendor-sysco-nr-txn", po: null, invoice: null },
  { id: "vf-2", viewId: "vendor-sysco-fac", entityType: "Facility", entityId: "fac-2", label: "Pine Grove", budget: 28000, spend: 31000, committed: 1100, variance: -3000, excluded: false, childViewId: "vendor-sysco-pg-txn", po: null, invoice: null },
  { id: "vf-3", viewId: "vendor-sysco-fac", entityType: "Facility", entityId: "fac-3", label: "Cedar Falls", budget: 22000, spend: 18000, committed: 1000, variance: 4000, excluded: false, childViewId: "vendor-sysco-cf-txn", po: null, invoice: null },

  // =====================================================================
  // US FOODS → FACILITIES — sum B=64000 S=71000 C=2800 V=-7000
  // =====================================================================
  { id: "vf-1b", viewId: "vendor-usfoods-fac", entityType: "Facility", entityId: "fac-1", label: "North Ridge", budget: 26000, spend: 28000, committed: 1100, variance: -2000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "vf-2b", viewId: "vendor-usfoods-fac", entityType: "Facility", entityId: "fac-2", label: "Pine Grove", budget: 22000, spend: 26000, committed: 1000, variance: -4000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "vf-3b", viewId: "vendor-usfoods-fac", entityType: "Facility", entityId: "fac-3", label: "Cedar Falls", budget: 16000, spend: 17000, committed: 700, variance: -1000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // PFG → FACILITIES — sum B=42000 S=39000 C=1600 V=3000
  // =====================================================================
  { id: "vf-1c", viewId: "vendor-pfg-fac", entityType: "Facility", entityId: "fac-1", label: "North Ridge", budget: 18000, spend: 16000, committed: 700, variance: 2000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "vf-2c", viewId: "vendor-pfg-fac", entityType: "Facility", entityId: "fac-2", label: "Pine Grove", budget: 14000, spend: 14000, committed: 500, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "vf-3c", viewId: "vendor-pfg-fac", entityType: "Facility", entityId: "fac-3", label: "Cedar Falls", budget: 10000, spend: 9000, committed: 400, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // MCKESSON → FACILITIES — sum B=55000 S=58500 C=2200 V=-3500
  // =====================================================================
  { id: "vf-1d", viewId: "vendor-mckesson-fac", entityType: "Facility", entityId: "fac-1", label: "North Ridge", budget: 22000, spend: 24000, committed: 900, variance: -2000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "vf-2d", viewId: "vendor-mckesson-fac", entityType: "Facility", entityId: "fac-2", label: "Pine Grove", budget: 18000, spend: 20000, committed: 700, variance: -2000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "vf-3d", viewId: "vendor-mckesson-fac", entityType: "Facility", entityId: "fac-3", label: "Cedar Falls", budget: 15000, spend: 14500, committed: 600, variance: 500, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // MEDLINE → FACILITIES — sum B=38000 S=35000 C=1400 V=3000
  // =====================================================================
  { id: "vf-1e", viewId: "vendor-medline-fac", entityType: "Facility", entityId: "fac-1", label: "North Ridge", budget: 16000, spend: 14000, committed: 600, variance: 2000, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "vf-2e", viewId: "vendor-medline-fac", entityType: "Facility", entityId: "fac-2", label: "Pine Grove", budget: 13000, spend: 13000, committed: 500, variance: 0, excluded: false, childViewId: null, po: null, invoice: null },
  { id: "vf-3e", viewId: "vendor-medline-fac", entityType: "Facility", entityId: "fac-3", label: "Cedar Falls", budget: 9000, spend: 8000, committed: 300, variance: 1000, excluded: false, childViewId: null, po: null, invoice: null },

  // =====================================================================
  // SYSCO / NORTH RIDGE → TXN — sum B=35000 S=33000 C=1400 V=2000
  // =====================================================================
  { id: "vt-1", viewId: "vendor-sysco-nr-txn", entityType: "Transaction", entityId: "txn-7001", label: "Invoice 7001", budget: 15000, spend: 14000, committed: 0, variance: 1000, excluded: false, childViewId: null, po: "PO 4001", invoice: "Invoice 7001" },
  { id: "vt-2", viewId: "vendor-sysco-nr-txn", entityType: "Transaction", entityId: "txn-7002", label: "Invoice 7002", budget: 10000, spend: 12000, committed: 0, variance: -2000, excluded: false, childViewId: null, po: null, invoice: "Invoice 7002" },
  { id: "vt-3", viewId: "vendor-sysco-nr-txn", entityType: "Transaction", entityId: "txn-7003", label: "Invoice 7003", budget: 6000, spend: 5000, committed: 0, variance: 1000, excluded: false, childViewId: null, po: "PO 4002", invoice: "Invoice 7003" },
  { id: "vt-4", viewId: "vendor-sysco-nr-txn", entityType: "Transaction", entityId: "txn-po-4003", label: "PO 4003", budget: 2500, spend: 1000, committed: 1400, variance: 1500, excluded: false, childViewId: null, po: "PO 4003", invoice: null },
  { id: "vt-5", viewId: "vendor-sysco-nr-txn", entityType: "Transaction", entityId: "txn-ma-4001", label: "Accrual 4001", budget: 1500, spend: 1000, committed: 0, variance: 500, excluded: false, childViewId: null, po: null, invoice: null, txnType: "MANUAL_ACCRUAL" },

  // =====================================================================
  // SYSCO / PINE GROVE → TXN — sum B=28000 S=31000 C=1100 V=-3000
  // =====================================================================
  { id: "vt-1b", viewId: "vendor-sysco-pg-txn", entityType: "Transaction", entityId: "txn-7004", label: "Invoice 7004", budget: 12000, spend: 14000, committed: 0, variance: -2000, excluded: false, childViewId: null, po: "PO 4004", invoice: "Invoice 7004" },
  { id: "vt-2b", viewId: "vendor-sysco-pg-txn", entityType: "Transaction", entityId: "txn-7005", label: "Invoice 7005", budget: 9000, spend: 10000, committed: 0, variance: -1000, excluded: false, childViewId: null, po: "PO 4004", invoice: "Invoice 7005" },
  { id: "vt-3b", viewId: "vendor-sysco-pg-txn", entityType: "Transaction", entityId: "txn-7006", label: "Invoice 7006", budget: 4000, spend: 4000, committed: 0, variance: 0, excluded: false, childViewId: null, po: null, invoice: "Invoice 7006" },
  { id: "vt-4b", viewId: "vendor-sysco-pg-txn", entityType: "Transaction", entityId: "txn-po-4005", label: "PO 4005", budget: 3000, spend: 3000, committed: 1100, variance: 0, excluded: false, childViewId: null, po: "PO 4005", invoice: null },

  // =====================================================================
  // SYSCO / CEDAR FALLS → TXN — sum B=22000 S=18000 C=1000 V=4000
  // =====================================================================
  { id: "vt-1c", viewId: "vendor-sysco-cf-txn", entityType: "Transaction", entityId: "txn-7007", label: "Invoice 7007", budget: 10000, spend: 8000, committed: 0, variance: 2000, excluded: false, childViewId: null, po: "PO 4006", invoice: "Invoice 7007" },
  { id: "vt-2c", viewId: "vendor-sysco-cf-txn", entityType: "Transaction", entityId: "txn-7008", label: "Invoice 7008", budget: 7000, spend: 6000, committed: 0, variance: 1000, excluded: false, childViewId: null, po: null, invoice: "Invoice 7008" },
  { id: "vt-3c", viewId: "vendor-sysco-cf-txn", entityType: "Transaction", entityId: "txn-po-4007", label: "PO 4007", budget: 5000, spend: 4000, committed: 1000, variance: 1000, excluded: false, childViewId: null, po: "PO 4007", invoice: null },
]

// ---------------------------------------------------------------------------
// Row time bucket values (junction records)
// ---------------------------------------------------------------------------

export const dbRowTimeBuckets: DbRowTimeBucket[] = [
  // Facility root rows
  { rowId: "fr-1", bucketId: "W1", total: 28000, actual: 25000, commitment: 3000, deduplicated: true },
  { rowId: "fr-1", bucketId: "W2", total: 29500, actual: 27000, commitment: 2500, deduplicated: true },
  { rowId: "fr-1", bucketId: "W3", total: 30000, actual: 28500, commitment: 1500, deduplicated: true },
  { rowId: "fr-2", bucketId: "W1", total: 22000, actual: 20000, commitment: 2000, deduplicated: true },
  { rowId: "fr-2", bucketId: "W2", total: 24000, actual: 22500, commitment: 1500, deduplicated: true },
  { rowId: "fr-2", bucketId: "W3", total: 23000, actual: 21000, commitment: 2000, deduplicated: true },
  { rowId: "fr-3", bucketId: "W1", total: 14000, actual: 13000, commitment: 1000, deduplicated: true },
  { rowId: "fr-3", bucketId: "W2", total: 15000, actual: 14200, commitment: 800, deduplicated: true },
  { rowId: "fr-3", bucketId: "W3", total: 14500, actual: 13800, commitment: 700, deduplicated: true },
  { rowId: "fr-4", bucketId: "W1", total: 24000, actual: 22000, commitment: 2000, deduplicated: true },
  { rowId: "fr-4", bucketId: "W2", total: 26000, actual: 24500, commitment: 1500, deduplicated: true },
  { rowId: "fr-4", bucketId: "W3", total: 25500, actual: 24000, commitment: 1500, deduplicated: true },
  { rowId: "fr-5", bucketId: "W1", total: 10500, actual: 9800, commitment: 700, deduplicated: true },
  { rowId: "fr-5", bucketId: "W2", total: 11000, actual: 10200, commitment: 800, deduplicated: true },
  { rowId: "fr-5", bucketId: "W3", total: 10800, actual: 10000, commitment: 800, deduplicated: true },
  // GL rows under NR
  { rowId: "fgl-1", bucketId: "W1", total: 15000, actual: 13500, commitment: 1500 },
  { rowId: "fgl-1", bucketId: "W2", total: 16500, actual: 15000, commitment: 1500 },
  { rowId: "fgl-1", bucketId: "W3", total: 16000, actual: 14500, commitment: 1500 },
  { rowId: "fgl-2", bucketId: "W1", total: 13000, actual: 11500, commitment: 1500 },
  { rowId: "fgl-2", bucketId: "W2", total: 13000, actual: 12000, commitment: 1000 },
  { rowId: "fgl-2", bucketId: "W3", total: 14000, actual: 13000, commitment: 1000 },
  { rowId: "fgl-3", bucketId: "W1", total: 1100, actual: 1100, commitment: 0 },
  { rowId: "fgl-3", bucketId: "W2", total: 1200, actual: 1200, commitment: 0 },
  { rowId: "fgl-3", bucketId: "W3", total: 1100, actual: 1100, commitment: 0 },
  // Vendor rows under NR/6100
  { rowId: "fv-1", bucketId: "W1", total: 7000, actual: 6200, commitment: 800 },
  { rowId: "fv-1", bucketId: "W2", total: 7500, actual: 6800, commitment: 700 },
  { rowId: "fv-1", bucketId: "W3", total: 7200, actual: 6500, commitment: 700 },
  { rowId: "fv-2", bucketId: "W1", total: 5200, actual: 4800, commitment: 400 },
  { rowId: "fv-2", bucketId: "W2", total: 5600, actual: 5100, commitment: 500 },
  { rowId: "fv-2", bucketId: "W3", total: 5400, actual: 4900, commitment: 500 },
  { rowId: "fv-3", bucketId: "W1", total: 2800, actual: 2500, commitment: 300 },
  { rowId: "fv-3", bucketId: "W2", total: 3400, actual: 3100, commitment: 300 },
  { rowId: "fv-3", bucketId: "W3", total: 3400, actual: 3100, commitment: 300 },
]

// ---------------------------------------------------------------------------
// Spend composition records
// ---------------------------------------------------------------------------

export const dbSpendCompositions: DbSpendComposition[] = [
  { rowId: "fr-1", actualTotal: 115000, commitmentOpen: 3200, commitmentRealized: 1600 },
  { rowId: "fr-2", actualTotal: 92000, commitmentOpen: 4100, commitmentRealized: 2000 },
  { rowId: "fr-3", actualTotal: 58000, commitmentOpen: 1500, commitmentRealized: 800 },
  { rowId: "fr-4", actualTotal: 101000, commitmentOpen: 2800, commitmentRealized: 1200 },
  { rowId: "fr-5", actualTotal: 43000, commitmentOpen: 1200, commitmentRealized: 600 },
  { rowId: "gr-1", actualTotal: 88000, commitmentOpen: 4200, commitmentRealized: 2100 },
  { rowId: "gr-2", actualTotal: 79000, commitmentOpen: 3100, commitmentRealized: 1500 },
  { rowId: "gr-3", actualTotal: 45000, commitmentOpen: 1800, commitmentRealized: 900 },
  { rowId: "gr-4", actualTotal: 37500, commitmentOpen: 1500, commitmentRealized: 700 },
  { rowId: "gr-5", actualTotal: 58000, commitmentOpen: 2400, commitmentRealized: 1200 },
  { rowId: "vr-1", actualTotal: 82000, commitmentOpen: 3500, commitmentRealized: 1800 },
  { rowId: "vr-2", actualTotal: 71000, commitmentOpen: 2800, commitmentRealized: 1400 },
  { rowId: "vr-3", actualTotal: 39000, commitmentOpen: 1600, commitmentRealized: 800 },
  { rowId: "vr-4", actualTotal: 58500, commitmentOpen: 2200, commitmentRealized: 1100 },
  { rowId: "vr-5", actualTotal: 35000, commitmentOpen: 1400, commitmentRealized: 700 },
]

// ---------------------------------------------------------------------------
// Census context records
// ---------------------------------------------------------------------------

export const dbCensusContexts: DbCensusContext[] = [
  // Facility census
  { rowId: "fr-1", basedOn: "MIXED", actualPercent: 0.82, projectedPercent: 0.18, impactsPPD: true },
  { rowId: "fr-2", basedOn: "MIXED", actualPercent: 0.82, projectedPercent: 0.18, impactsPPD: true },
  { rowId: "fr-3", basedOn: "MIXED", actualPercent: 0.82, projectedPercent: 0.18, impactsPPD: true },
  { rowId: "fr-4", basedOn: "MIXED", actualPercent: 0.82, projectedPercent: 0.18, impactsPPD: true },
  { rowId: "fr-5", basedOn: "MIXED", actualPercent: 0.82, projectedPercent: 0.18, impactsPPD: true },
  // GL census
  { rowId: "fgl-1", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-2", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-3", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-1b", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-2b", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-1c", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-2c", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-1d", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-2d", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-1e", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "fgl-2e", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "gr-1", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "gr-2", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "gr-3", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "gr-4", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  { rowId: "gr-5", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: true },
  // Vendor census
  { rowId: "fv-1", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-2", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-3", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-4", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-5", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-6", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  // PG vendor census
  { rowId: "fv-pg-1", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-pg-2", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-pg-3", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-pg-4", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-pg-5", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-pg-6", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  // CF vendor census
  { rowId: "fv-cf-1", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-cf-2", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-cf-3", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-cf-4", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-cf-5", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-cf-6", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  // WC vendor census
  { rowId: "fv-wc-1", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-wc-2", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-wc-3", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-wc-4", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-wc-5", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-wc-6", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  // MT vendor census
  { rowId: "fv-mt-1", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-mt-2", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-mt-3", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-mt-4", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-mt-5", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fv-mt-6", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "gv-1", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "gv-2", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "gv-3", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "vr-1", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "vr-2", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "vr-3", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "vr-4", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "vr-5", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  // Facility rows under vendor
  { rowId: "vf-1", basedOn: "MIXED", actualPercent: 0.82, projectedPercent: 0.18, impactsPPD: true },
  { rowId: "vf-2", basedOn: "MIXED", actualPercent: 0.82, projectedPercent: 0.18, impactsPPD: true },
  { rowId: "vf-3", basedOn: "MIXED", actualPercent: 0.82, projectedPercent: 0.18, impactsPPD: true },
  // Transaction census
  { rowId: "ft-1", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "ft-2", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "ft-3", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "ft-4", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "ft-5", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "gt-1", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "gt-2", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "gt-3", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "gt-4", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "vt-1", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "vt-2", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "vt-3", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "vt-4", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  // Manual accrual transaction census
  { rowId: "ft-6", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "ft-5u", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "gt-5", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "vt-5", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  // Excluded vendor census
  { rowId: "fev-1", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fev-2", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  { rowId: "fev-3", basedOn: "MIXED", actualPercent: 0.75, projectedPercent: 0.25, impactsPPD: true },
  // Excluded txn census
  { rowId: "fet-1", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "fet-2", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
  { rowId: "fet-3", basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false },
]

// ---------------------------------------------------------------------------
// Programmatic Transaction View Generation
//
// For every Vendor-type or Facility-type row that has no childViewId,
// generate a transaction view with 3-4 rows whose values sum exactly
// to the parent row. This guarantees reconciliation by construction.
// ---------------------------------------------------------------------------

let txnCounter = 1000
let txnRowCounter = 9000

function generateTxnRowsForVendor(vendorRow: DbRow, txnViewId: string): DbRow[] {
  const B = vendorRow.budget
  const S = vendorRow.spend
  const C = vendorRow.committed
  const V = vendorRow.variance
  const isExcl = vendorRow.excluded

  const b1 = Math.round(B * 0.42)
  const b2 = Math.round(B * 0.33)
  const s1 = Math.round(S * 0.42)
  const s2 = Math.round(S * 0.33)

  const hasPO = C > 0
  const rows: DbRow[] = []

  const inv1Id = txnRowCounter++
  const inv2Id = txnRowCounter++
  const inv3Id = txnRowCounter++

  const maId = txnRowCounter++

  if (hasPO) {
    const b3 = Math.round(B * 0.10)
    const s3 = Math.round(S * 0.10)
    const bMA = Math.round(B * 0.05)
    const sMA = Math.round(S * 0.05)
    const bPO = B - b1 - b2 - b3 - bMA
    const sPO = S - s1 - s2 - s3 - sMA
    const v1 = isExcl ? null : b1 - s1
    const v2 = isExcl ? null : b2 - s2
    const v3 = isExcl ? null : b3 - s3
    const vMA = isExcl ? null : bMA - sMA
    const vPO = isExcl ? null : (V! - ((v1 as number) + (v2 as number) + (v3 as number) + (vMA as number)))
    const poId = txnRowCounter++
    const poRef = `PO ${txnCounter++}`

    rows.push(
      { id: `gtx-${inv1Id}`, viewId: txnViewId, entityType: "Transaction", entityId: `txn-g${inv1Id}`, label: `Invoice ${txnCounter}`, budget: b1, spend: s1, committed: 0, variance: v1, excluded: isExcl, childViewId: null, po: poRef, invoice: `Invoice ${txnCounter++}` },
      { id: `gtx-${inv2Id}`, viewId: txnViewId, entityType: "Transaction", entityId: `txn-g${inv2Id}`, label: `Invoice ${txnCounter}`, budget: b2, spend: s2, committed: 0, variance: v2, excluded: isExcl, childViewId: null, po: null, invoice: `Invoice ${txnCounter++}` },
      { id: `gtx-${inv3Id}`, viewId: txnViewId, entityType: "Transaction", entityId: `txn-g${inv3Id}`, label: `Invoice ${txnCounter}`, budget: b3, spend: s3, committed: 0, variance: v3, excluded: isExcl, childViewId: null, po: `PO ${txnCounter - 1}`, invoice: `Invoice ${txnCounter++}` },
      { id: `gtx-${poId}`, viewId: txnViewId, entityType: "Transaction", entityId: `txn-g${poId}`, label: poRef, budget: bPO, spend: sPO, committed: C, variance: vPO, excluded: isExcl, childViewId: null, po: poRef, invoice: null },
      { id: `gtx-${maId}`, viewId: txnViewId, entityType: "Transaction", entityId: `txn-g${maId}`, label: `Accrual ${txnCounter++}`, budget: bMA, spend: sMA, committed: 0, variance: vMA, excluded: isExcl, childViewId: null, po: null, invoice: null, txnType: "MANUAL_ACCRUAL" },
    )
  } else {
    const bMA = Math.round(B * 0.05)
    const sMA = Math.round(S * 0.05)
    const b3 = B - b1 - b2 - bMA
    const s3 = S - s1 - s2 - sMA
    const v1 = isExcl ? null : b1 - s1
    const v2 = isExcl ? null : b2 - s2
    const vMA = isExcl ? null : bMA - sMA
    const v3 = isExcl ? null : (V! - ((v1 as number) + (v2 as number) + (vMA as number)))

    rows.push(
      { id: `gtx-${inv1Id}`, viewId: txnViewId, entityType: "Transaction", entityId: `txn-g${inv1Id}`, label: `Invoice ${txnCounter}`, budget: b1, spend: s1, committed: 0, variance: v1, excluded: isExcl, childViewId: null, po: `PO ${txnCounter}`, invoice: `Invoice ${txnCounter++}` },
      { id: `gtx-${inv2Id}`, viewId: txnViewId, entityType: "Transaction", entityId: `txn-g${inv2Id}`, label: `Invoice ${txnCounter}`, budget: b2, spend: s2, committed: 0, variance: v2, excluded: isExcl, childViewId: null, po: null, invoice: `Invoice ${txnCounter++}` },
      { id: `gtx-${inv3Id}`, viewId: txnViewId, entityType: "Transaction", entityId: `txn-g${inv3Id}`, label: `Invoice ${txnCounter}`, budget: b3, spend: s3, committed: 0, variance: v3, excluded: isExcl, childViewId: null, po: `PO ${txnCounter - 1}`, invoice: `Invoice ${txnCounter++}` },
      { id: `gtx-${maId}`, viewId: txnViewId, entityType: "Transaction", entityId: `txn-g${maId}`, label: `Accrual ${txnCounter++}`, budget: bMA, spend: sMA, committed: 0, variance: vMA, excluded: isExcl, childViewId: null, po: null, invoice: null, txnType: "MANUAL_ACCRUAL" },
    )
  }

  return rows
}

// ---------------------------------------------------------------------------
// Independent Aggregate Source Layer (declared before generation loop so
// programmatic txn views can register their inherited aggregates)
// ---------------------------------------------------------------------------
const dbAggregates: Record<string, { budget: number; consumed: number; excludedSpend: number }> = {
  "fac-root": { budget: 400000, consumed: 409000, excludedSpend: 0 },
  "fac-northridge-gl": { budget: 120000, consumed: 115000, excludedSpend: 4500 },
  "fac-pinegrove-gl": { budget: 80000, consumed: 92000, excludedSpend: 0 },
  "fac-cedarfalls-gl": { budget: 60000, consumed: 58000, excludedSpend: 0 },
  "fac-willowcreek-gl": { budget: 95000, consumed: 101000, excludedSpend: 0 },
  "fac-mapleterrace-gl": { budget: 45000, consumed: 43000, excludedSpend: 0 },
  "fac-nr-gl6100-vendor": { budget: 65000, consumed: 62000, excludedSpend: 0 },
  "fac-nr-gl7200-vendor": { budget: 55000, consumed: 53000, excludedSpend: 0 },
  "fac-nr-gl5400-vendor": { budget: 0, consumed: 0, excludedSpend: 4500 },
  "fac-pg-gl6100-vendor": { budget: 48000, consumed: 55000, excludedSpend: 0 },
  "fac-pg-gl7200-vendor": { budget: 32000, consumed: 37000, excludedSpend: 0 },
  "fac-cf-gl6100-vendor": { budget: 36000, consumed: 34000, excludedSpend: 0 },
  "fac-cf-gl7200-vendor": { budget: 24000, consumed: 24000, excludedSpend: 0 },
  "fac-wc-gl6100-vendor": { budget: 55000, consumed: 59000, excludedSpend: 0 },
  "fac-wc-gl7200-vendor": { budget: 40000, consumed: 42000, excludedSpend: 0 },
  "fac-mt-gl6100-vendor": { budget: 27000, consumed: 25000, excludedSpend: 0 },
  "fac-mt-gl7200-vendor": { budget: 18000, consumed: 18000, excludedSpend: 0 },
  "fac-nr-6100-sysco-txn": { budget: 30000, consumed: 28000, excludedSpend: 0 },
  "fac-nr-6100-usfoods-txn": { budget: 22000, consumed: 24000, excludedSpend: 0 },
  "fac-nr-6100-pfg-txn": { budget: 13000, consumed: 10000, excludedSpend: 0 },
  "fac-nr-5400-sysco-txn": { budget: 0, consumed: 0, excludedSpend: 2000 },
  "fac-nr-5400-usfoods-txn": { budget: 0, consumed: 0, excludedSpend: 1500 },
  "fac-nr-5400-pfg-txn": { budget: 0, consumed: 0, excludedSpend: 1000 },
  "gl-root": { budget: 312000, consumed: 307500, excludedSpend: 0 },
  "gl-6100-vendor": { budget: 95000, consumed: 88000, excludedSpend: 0 },
  "gl-7200-vendor": { budget: 72000, consumed: 79000, excludedSpend: 0 },
  "gl-5400h-vendor": { budget: 48000, consumed: 45000, excludedSpend: 0 },
  "gl-6200-vendor": { budget: 35000, consumed: 37500, excludedSpend: 0 },
  "gl-8100-vendor": { budget: 62000, consumed: 58000, excludedSpend: 0 },
  "gl-6100-sysco-txn": { budget: 40000, consumed: 38000, excludedSpend: 0 },
  "gl-6100-usfoods-txn": { budget: 30000, consumed: 32000, excludedSpend: 0 },
  "gl-6100-pfg-txn": { budget: 25000, consumed: 18000, excludedSpend: 0 },
  "vendor-root": { budget: 284000, consumed: 285500, excludedSpend: 0 },
  "vendor-sysco-fac": { budget: 85000, consumed: 82000, excludedSpend: 0 },
  "vendor-usfoods-fac": { budget: 64000, consumed: 71000, excludedSpend: 0 },
  "vendor-pfg-fac": { budget: 42000, consumed: 39000, excludedSpend: 0 },
  "vendor-mckesson-fac": { budget: 55000, consumed: 58500, excludedSpend: 0 },
  "vendor-medline-fac": { budget: 38000, consumed: 35000, excludedSpend: 0 },
  "vendor-sysco-nr-txn": { budget: 35000, consumed: 33000, excludedSpend: 0 },
  "vendor-sysco-pg-txn": { budget: 28000, consumed: 31000, excludedSpend: 0 },
  "vendor-sysco-cf-txn": { budget: 22000, consumed: 18000, excludedSpend: 0 },
}

// Find all Vendor and Facility rows that lack a childViewId and generate transaction views
const vendorLikeRows = dbRows.filter(
  r => (r.entityType === "Vendor" || r.entityType === "Facility") && r.childViewId === null
)

for (const vRow of vendorLikeRows) {
  const txnViewId = `txn-gen-${vRow.id}`

  // Set childViewId on the parent row
  ;(vRow as any).childViewId = txnViewId

  // Determine context from the parent view
  const parentView = dbViews.find(v => v.id === vRow.viewId)
  const contextId = parentView?.contextId ?? "ctx-default"

  // Create view record
  dbViews.push({
    id: txnViewId,
    contextId,
    metaId: "meta-1",
    scopeLabel: `Transactions within ${vRow.label}`,
    entityTypeLabel: "Transactions",
  })

  // Create breadcrumbs: copy parent view's breadcrumbs, make the last one clickable,
  // then add a new terminal segment for this entity name
  const parentBreadcrumbs = dbBreadcrumbs
    .filter(b => b.viewId === vRow.viewId)
    .sort((a, b) => a.position - b.position)

  for (const pb of parentBreadcrumbs) {
    const isLast = pb.position === parentBreadcrumbs.length - 1
    dbBreadcrumbs.push({
      viewId: txnViewId,
      position: pb.position,
      label: pb.label,
      targetViewId: isLast ? vRow.viewId : pb.targetViewId,
    })
  }
  dbBreadcrumbs.push({
    viewId: txnViewId,
    position: parentBreadcrumbs.length,
    label: vRow.label,
    targetViewId: null,
  })

  // Step 3 (cont.): Inherit aggregate from parent row seed primitives
  // Transaction view KPI = parent row's values, NOT sum of txn rows
  dbAggregates[txnViewId] = {
    budget: vRow.excluded ? 0 : vRow.budget,
    consumed: vRow.excluded ? 0 : vRow.spend,
    excludedSpend: vRow.excluded ? vRow.spend : 0,
  }

  // Generate transaction rows
  const txnRows = generateTxnRowsForVendor(vRow, txnViewId)
  dbRows.push(...txnRows)

  // Add census contexts for generated txn rows
  for (const tr of txnRows) {
    dbCensusContexts.push({ rowId: tr.id, basedOn: "ACTUAL", actualPercent: 1.0, impactsPPD: false })
  }

  // Add exclusion records if parent is excluded
  if (vRow.excluded) {
    for (const tr of txnRows) {
      dbExclusions.push({ rowId: tr.id, impact: "FULL", reason: "Parent excluded", source: "Budget Kernel", propagated: true })
    }
  }
}

// ---------------------------------------------------------------------------
// Decomposition records (rebuilt to include generated rows)
// ---------------------------------------------------------------------------

export const dbDecompositions: DbDecomposition[] = [
  ...dbRows.map(r => ({ rowId: r.id, ...defaultDecomp })),
]

// ---------------------------------------------------------------------------
// Lineage records
// ---------------------------------------------------------------------------

export const dbLineages: DbLineage[] = [
  { rowId: "fgl-1", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "fgl-2", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "fgl-3", budget: "Budget Kernel", spend: "Spend Gate" },
  { rowId: "gr-1", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "gr-2", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "gr-3", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "gr-4", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "gr-5", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "ft-1", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "ft-2", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "ft-3", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "ft-4", budget: "Budget Kernel", spend: "Spend Gate" },
  { rowId: "ft-5", budget: "Budget Kernel", spend: "Spend Gate" },
  { rowId: "gt-1", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "gt-2", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "gt-3", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "gt-4", budget: "Budget Kernel", spend: "Spend Gate" },
  { rowId: "vt-1", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "vt-2", budget: "Budget Kernel", spend: "Spend Gate" },
  { rowId: "vt-3", budget: "Budget Kernel", spend: "Spend Gate", census: "Census Gate", time: "Time Model" },
  { rowId: "vt-4", budget: "Budget Kernel", spend: "Spend Gate" },
]

// ---------------------------------------------------------------------------
// Aggregation records
// ---------------------------------------------------------------------------

export const dbAggregations: DbAggregation[] = [
  ...dbRows.filter(r => r.entityType !== "Transaction").map(r => ({
    rowId: r.id, method: "SUM_CHILDREN" as const, childReconciliation: "MATCH" as const,
  })),
  ...dbRows.filter(r => r.entityType === "Transaction").map(r => ({
    rowId: r.id, method: "DIRECT" as const, childReconciliation: "MATCH" as const,
  })),
]

// ---------------------------------------------------------------------------
// Drill records
// ---------------------------------------------------------------------------

export const dbDrills: DbDrill[] = dbRows
  .filter(r => r.childViewId !== null)
  .map(r => ({
    rowId: r.id,
    nextPivot: r.entityType === "Facility" ? "GL_ACCOUNT" : r.entityType === "GL Account" ? "VENDOR" : r.entityType === "Vendor" ? "TRANSACTION" : "NONE",
    available: true,
  }))

// ---------------------------------------------------------------------------
// Exclusion records
// ---------------------------------------------------------------------------

export const dbExclusions: DbExclusion[] = [
  // Excluded GL (NR only)
  { rowId: "fgl-3", impact: "FULL", reason: "GL Account excluded from budget", source: "Budget Kernel", propagated: true },
  // Excluded vendors under GL 5400
  { rowId: "fev-1", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
  { rowId: "fev-2", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
  { rowId: "fev-3", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
  // Excluded txn rows
  { rowId: "fet-1", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
  { rowId: "fet-2", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
  { rowId: "fet-3", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
  { rowId: "fet-1x", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
  { rowId: "fet-2x", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
  { rowId: "fet-1y", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
  { rowId: "fet-2y", impact: "FULL", reason: "Parent GL excluded", source: "Budget Kernel", propagated: true },
]

// ---------------------------------------------------------------------------
// Census display records
// ---------------------------------------------------------------------------

function buildCensusDisplay(rowId: string, entityType: DbRow["entityType"], index: number): DbCensusDisplay {
  const entries: { type: string; value: number }[] = []
  if (entityType === "Facility") {
    entries.push({ type: "Patient Days", value: 480 + index * 37 })
    entries.push({ type: "Resident Days", value: 150 + index * 19 })
  } else if (entityType === "GL Account") {
    entries.push({ type: "Patient Days", value: 534 + index * 23 })
  } else if (entityType === "Vendor") {
    entries.push({ type: "Patient Days", value: 412 + index * 31 })
    entries.push({ type: "Resident Days", value: 177 + index * 14 })
  } else {
    entries.push({ type: "Patient Days", value: 320 + index * 15 })
  }
  return { rowId, entityType, entries }
}

const censusDisplayMap = new Map<string, DbCensusDisplay>()
const viewRowIndices = new Map<string, number>()
for (const r of dbRows) {
  const idx = viewRowIndices.get(r.viewId) ?? 0
  viewRowIndices.set(r.viewId, idx + 1)
  censusDisplayMap.set(r.id, buildCensusDisplay(r.id, r.entityType, idx))
}

export { censusDisplayMap }

// ---------------------------------------------------------------------------
// Authoritative KPI — Independent Aggregate Source Layer
//
// KPI values (budget, consumed, variance, percent, excludedSpend) are sourced
// EXCLUSIVELY from dbAggregates — an independent aggregate layer populated
// from seed primitives. computeAuthoritativeKpi does NOT read from dbRows[].
// consumed = non-excluded spend only. variance = budget - consumed (derived).
// excludedSpend = sum of excluded rows' spend (separate, does not affect variance).
//
// For transaction-level views, aggregates are INHERITED from the parent
// row's seed primitive values (the vendor/facility row drilled into),
// NOT recomputed by summing transaction rows.
//
// Row counts in the reconciliation block are metadata-only and do not
// influence KPI values.
//
// BUDGET SOURCE RULE:
//   budgets_daily = authoritative budget source (future Postgres)
//   transactions.amount_budget = contextual display only
//   In the current seed model, DbRow.budget at aggregate levels represents
//   the budgets_daily equivalent. At transaction level, it represents
//   transactions.amount_budget. Both are pre-reconciled by construction.
// ---------------------------------------------------------------------------

// Step 2: computeAuthoritativeKpi — pure lookup, NO dbRows dependency
// Variance is ALWAYS derived: variance = budget - consumed (never stored/overridden)
function computeAuthoritativeKpi(viewId: string): { budget: number; consumed: number; variance: number; percent: number; excludedSpend: number } {
  const agg = dbAggregates[viewId]
  if (!agg) {
    console.error(`[KPI] No aggregate entry for view "${viewId}" — defaulting to zeros`)
    return { budget: 0, consumed: 0, variance: 0, percent: 0, excludedSpend: 0 }
  }
  const budget = agg.budget
  const consumed = agg.consumed
  const variance = budget - consumed
  const percent = budget === 0 ? 0 : Math.round((variance / budget) * 100)
  const excludedSpend = agg.excludedSpend
  return { budget, consumed, variance, percent, excludedSpend }
}

// Step 3: Row-count metadata (informational only — does NOT influence KPI values)
function getViewRowCounts(viewId: string): { rowCount: number; includedRows: number; excludedRows: number } {
  const viewRows = dbRows.filter(r => r.viewId === viewId)
  return {
    rowCount: viewRows.length,
    includedRows: viewRows.filter(r => !r.excluded).length,
    excludedRows: viewRows.filter(r => r.excluded).length,
  }
}

for (const view of dbViews) {
  const k = computeAuthoritativeKpi(view.id)
  const counts = getViewRowCounts(view.id)
  view.kpi = {
    id: `kpi-${view.id}`,
    viewId: view.id,
    budget: k.budget,
    consumed: k.consumed,
    variance: k.variance,
    percent: k.percent,
    excludedSpend: k.excludedSpend,
    reconciliation: {
      kpiId: `kpi-${view.id}`,
      rowCount: counts.rowCount,
      includedRows: counts.includedRows,
      excludedRows: counts.excludedRows,
      checksum: `chk-${counts.rowCount}-${k.budget}`,
    },
  }
}

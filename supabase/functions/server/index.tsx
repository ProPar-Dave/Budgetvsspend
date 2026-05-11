import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildFacilityRoot, buildFacilityGlDrill, buildFacilityGlVendorDrill, buildFacilityGlVendorTxnDrill,
  buildGlRoot, buildGlVendorDrill, buildGlVendorTxnDrill,
  buildVendorRoot, buildVendorFacDrill, buildVendorFacTxnDrill,
  getFacilityNames as bvsGetFacilityNames,
  buildPeriodBreakdown,
  buildSparklineData,
} from "./bvs-queries.tsx";
import type { SpendMode } from "./bvs-queries.tsx";
import { resolveDateRange, yearRange } from "./bvs-queries.tsx";

// Ship 4a: strip enriched fields from a view result for the legacy shape.
// Mutates in place for efficiency — the result object is about to be
// serialized and discarded, so the mutation is safe.
function stripEnrichedFields(result: any): void {
  if (result?.rows && Array.isArray(result.rows)) {
    for (const row of result.rows) {
      delete row.spendPPD;
      delete row.budgetPPD;
      delete row.variancePPD;
    }
  }
  if (result?.view?.kpi) {
    delete result.view.kpi.spendPPD;
    delete result.view.kpi.budgetPPD;
    delete result.view.kpi.variancePPD;
  }
}

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-BVS-Response-Shape"],
    maxAge: 600,
  }),
);

// Health check endpoint — Ship 1: async, returns anchorYear instead of manual deploy stamp
app.get("/make-server-b98afb97/health", async (c) => {
  try {
    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);
    return c.json({ status: "ok", ts: Date.now(), anchorYear });
  } catch (err: any) {
    return c.json({ status: "degraded", ts: Date.now(), error: err?.message ?? String(err) }, 200);
  }
});

// ---------------------------------------------------------------------------
// Report Data API — KV-backed storage for report views
// ---------------------------------------------------------------------------

// Seed all report view data into KV store
// Expects: { views: Record<string, any>, facilityNames: string[], censusDisplays: Record<string, any> }
app.post("/make-server-b98afb97/report/seed", async (c) => {
  try {
    const body = await c.req.json();
    const { views, facilityNames, censusDisplays } = body;

    if (!views || typeof views !== "object") {
      return c.json({ error: "Missing or invalid 'views' in request body" }, 400);
    }

    // Store each view under its own key
    const viewKeys: string[] = [];
    const viewValues: any[] = [];
    for (const [viewId, viewData] of Object.entries(views)) {
      viewKeys.push(`report:view:${viewId}`);
      viewValues.push(viewData);
    }

    // Store facility names
    viewKeys.push("report:facilityNames");
    viewValues.push(facilityNames ?? []);

    // Store census display map
    if (censusDisplays && typeof censusDisplays === "object") {
      viewKeys.push("report:censusDisplays");
      viewValues.push(censusDisplays);
    }

    // Store view index for listing
    viewKeys.push("report:viewIndex");
    viewValues.push(Object.keys(views));

    // Store all views as a single bundle for bulk retrieval
    viewKeys.push("report:allViews");
    viewValues.push(views);

    // Store version marker
    viewKeys.push("report:version");
    viewValues.push("v8-excluded-spend-separation");

    // Batch write
    await kv.mset(viewKeys, viewValues);

    console.log(`Seeded ${Object.keys(views).length} report views into KV store`);
    return c.json({ status: "ok", viewCount: Object.keys(views).length });
  } catch (err: any) {
    console.log(`Error seeding report data: ${err?.message ?? err}`);
    return c.json({ error: `Seed error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Get all report views at once
app.get("/make-server-b98afb97/report/views/all", async (c) => {
  try {
    const allViews = await kv.get("report:allViews");
    if (!allViews || typeof allViews !== "object") {
      return c.json({ error: "No views found" }, 404);
    }
    return c.json(allViews);
  } catch (err: any) {
    console.log(`Error retrieving all views: ${err?.message ?? err}`);
    return c.json({ error: `Retrieval error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Get a single report view by ID
app.get("/make-server-b98afb97/report/view/:viewId", async (c) => {
  try {
    const viewId = c.req.param("viewId");
    const viewData = await kv.get(`report:view:${viewId}`);

    if (!viewData) {
      return c.json({ error: `View not found: ${viewId}` }, 404);
    }

    return c.json(viewData);
  } catch (err: any) {
    console.log(`Error retrieving view: ${err?.message ?? err}`);
    return c.json({ error: `Retrieval error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Get facility names
app.get("/make-server-b98afb97/report/facility-names", async (c) => {
  try {
    const names = await kv.get("report:facilityNames");
    return c.json(names ?? []);
  } catch (err: any) {
    console.log(`Error retrieving facility names: ${err?.message ?? err}`);
    return c.json({ error: `Retrieval error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Get census display map
app.get("/make-server-b98afb97/report/census-displays", async (c) => {
  try {
    const displays = await kv.get("report:censusDisplays");
    return c.json(displays ?? {});
  } catch (err: any) {
    console.log(`Error retrieving census displays: ${err?.message ?? err}`);
    return c.json({ error: `Retrieval error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Check if seed data exists
app.get("/make-server-b98afb97/report/seed-status", async (c) => {
  try {
    const viewIndex = await kv.get("report:viewIndex");
    const version = await kv.get("report:version");
    return c.json({ seeded: !!viewIndex, viewCount: viewIndex?.length ?? 0, version: version ?? null });
  } catch (err: any) {
    console.log(`Error checking seed status: ${err?.message ?? err}`);
    return c.json({ error: `Status check error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// BVS Schema — Direct Postgres connection via Supabase client
// ---------------------------------------------------------------------------

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getBvsClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: "bvs" },
  });
}

// Connection verification — runs the spec's verification query
app.get("/make-server-b98afb97/bvs/verify", async (c) => {
  try {
    const bvs = getBvsClient();

    // Run verification via RPC or raw query. Supabase JS doesn't support
    // cross-schema joins natively, so we use the rpc approach with a
    // direct SQL call through the REST API. We'll query each table
    // individually first to prove connectivity, then attempt the join.

    // Step 1: Verify table access — count each table
    const [facilities, glAccounts, vendors, transactions, budgets, exclusions] =
      await Promise.all([
        bvs.from("facilities").select("id", { count: "exact", head: true }),
        bvs.from("gl_accounts").select("id", { count: "exact", head: true }),
        bvs.from("vendors").select("id", { count: "exact", head: true }),
        bvs.from("transactions").select("id", { count: "exact", head: true }),
        bvs.from("budgets_daily").select("id", { count: "exact", head: true }),
        bvs.from("exclusions").select("id", { count: "exact", head: true }),
      ]);

    const tableCounts = {
      facilities: { count: facilities.count, error: facilities.error?.message ?? null },
      gl_accounts: { count: glAccounts.count, error: glAccounts.error?.message ?? null },
      vendors: { count: vendors.count, error: vendors.error?.message ?? null },
      transactions: { count: transactions.count, error: transactions.error?.message ?? null },
      budgets_daily: { count: budgets.count, error: budgets.error?.message ?? null },
      exclusions: { count: exclusions.count, error: exclusions.error?.message ?? null },
    };

    const allTablesOk = Object.values(tableCounts).every(
      (t) => t.error === null && t.count !== null
    );

    // Step 2: Run the verification join query via Postgres function
    // We'll use supabase.rpc if a function exists, otherwise we fall back
    // to constructing the join client-side using fetched data.
    // Since Supabase JS can't do cross-table joins in bvs schema directly,
    // we'll use the DB URL with the postgres driver.
    let joinResult: { total_spend: number | null; total_budget: number | null } | null = null;
    let joinError: string | null = null;

    try {
      const dbUrl = Deno.env.get("SUPABASE_DB_URL");
      if (dbUrl) {
        const { default: postgres } = await import("npm:postgres@3.4.4");
        const sql = postgres(dbUrl, { ssl: "prefer" });

        const [yrRow] = await sql`
          SELECT DATE_PART('year', MAX(txn_date))::int AS yr
          FROM bvs.transactions
        `;
        const verifyYear = Number(yrRow?.yr) && Number(yrRow.yr) >= 2000 && Number(yrRow.yr) <= 2100
          ? Number(yrRow.yr)
          : new Date().getUTCFullYear();

        const rows = await sql`
          SELECT
            SUM(t.amount_actual + t.amount_committed) AS total_spend,
            SUM(b.amount) AS total_budget
          FROM bvs.transactions t
          JOIN bvs.budgets_daily b
            ON b.facility_id = t.facility_id
            AND b.gl_account_id = t.gl_account_id
            AND DATE_TRUNC('month', t.txn_date) = b.effective_date
          JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
          WHERE t.excluded = false

            AND g.excluded = false
            AND t.txn_date >= '${verifyYear}-01-01'::date
            AND t.txn_date < '${verifyYear + 1}-01-01'::date
        `;

        if (rows.length > 0) {
          joinResult = {
            total_spend: rows[0].total_spend !== null ? Number(rows[0].total_spend) : null,
            total_budget: rows[0].total_budget !== null ? Number(rows[0].total_budget) : null,
          };
        }

        await sql.end();
      } else {
        joinError = "SUPABASE_DB_URL not configured";
      }
    } catch (err: any) {
      joinError = `Join query error: ${err?.message ?? err}`;
      console.log(`BVS join verification error: ${joinError}`);
    }

    const connectionLive =
      allTablesOk &&
      joinResult !== null &&
      joinResult.total_spend !== null &&
      joinResult.total_budget !== null;

    return c.json({
      status: connectionLive ? "VERIFIED" : "PARTIAL",
      connectionLive,
      tableCounts,
      verificationQuery: {
        result: joinResult,
        error: joinError,
        pass:
          joinResult !== null &&
          joinResult.total_spend !== null &&
          joinResult.total_budget !== null,
      },
    });
  } catch (err: any) {
    console.log(`BVS verify error: ${err?.message ?? err}`);
    return c.json(
      { status: "ERROR", error: `BVS verify failed: ${err?.message ?? err}` },
      500
    );
  }
});

// Fetch table metadata (column names, sample row) for any bvs table
app.get("/make-server-b98afb97/bvs/table/:tableName", async (c) => {
  try {
    const tableName = c.req.param("tableName");
    const allowed = ["facilities", "gl_accounts", "vendors", "transactions", "budgets_daily", "exclusions"];
    if (!allowed.includes(tableName)) {
      return c.json({ error: `Table not allowed: ${tableName}` }, 400);
    }

    const bvs = getBvsClient();
    const { data, error, count } = await bvs
      .from(tableName)
      .select("*", { count: "exact" })
      .limit(5);

    if (error) {
      return c.json({ error: `Query error on ${tableName}: ${error.message}` }, 500);
    }

    return c.json({
      table: tableName,
      totalRows: count,
      sampleRows: data,
      columns: data && data.length > 0 ? Object.keys(data[0]) : [],
    });
  } catch (err: any) {
    console.log(`BVS table inspect error: ${err?.message ?? err}`);
    return c.json({ error: `Table inspect failed: ${err?.message ?? err}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// BVS Live Report Views — dynamically aggregated from bvs.* tables
// ---------------------------------------------------------------------------

let _sqlPool: any = null;
let _sqlPoolCreatedAt = 0;
const SQL_POOL_MAX_AGE = 60000; // recreate pool after 60s to avoid stale connections

async function getBvsSql() {
  const now = Date.now();
  if (_sqlPool) {
    // Recreate if pool is too old
    if (now - _sqlPoolCreatedAt > SQL_POOL_MAX_AGE) {
      console.log("BVS SQL pool expired, reconnecting...");
      try { await _sqlPool.end(); } catch { /* ignore */ }
      _sqlPool = null;
    } else {
      // Verify the pool is still alive with a lightweight check
      try {
        await _sqlPool`SELECT 1`;
        return _sqlPool;
      } catch {
        console.log("BVS SQL pool stale, reconnecting...");
        try { await _sqlPool.end(); } catch { /* ignore */ }
        _sqlPool = null;
      }
    }
  }
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new Error("SUPABASE_DB_URL not configured");
  const { default: postgres } = await import("npm:postgres@3.4.4");
  _sqlPool = postgres(dbUrl, { ssl: "prefer", max: 5, idle_timeout: 30, connect_timeout: 30 });
  _sqlPoolCreatedAt = now;
  return _sqlPool;
}

// ---------------------------------------------------------------------------
// Anchor-year resolver — Ship 1 of the BVS roadmap.
// Replaces the literal year=2025 default with MAX(txn_date)'s year.
// Cached for 60s so high-traffic periods don't thrash the transactions table.
// Bound: at year rollover, new-year data is visible within 60s of the first
// new-year transaction.
// ---------------------------------------------------------------------------
let _anchorYearCache: { year: number; fetchedAt: number } | null = null;
const ANCHOR_YEAR_CACHE_MS = 60_000;

async function getAnchorYear(sql: any): Promise<number> {
  const now = Date.now();
  if (_anchorYearCache && now - _anchorYearCache.fetchedAt < ANCHOR_YEAR_CACHE_MS) {
    return _anchorYearCache.year;
  }
  try {
    const [row] = await sql`
      SELECT DATE_PART('year', MAX(txn_date))::int AS yr
      FROM bvs.transactions
    `;
    const year = Number(row?.yr);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      console.log(`BVS anchor-year: unexpected MAX(txn_date) year=${row?.yr}; falling back to current UTC year`);
      _anchorYearCache = { year: new Date().getUTCFullYear(), fetchedAt: now };
    } else {
      _anchorYearCache = { year, fetchedAt: now };
    }
  } catch (err: any) {
    console.log(`BVS anchor-year lookup failed: ${err?.message ?? err}; falling back to current UTC year`);
    _anchorYearCache = { year: new Date().getUTCFullYear(), fetchedAt: now };
  }
  return _anchorYearCache.year;
}

// Generic view resolver — parses the viewId to determine which query to run
app.get("/make-server-b98afb97/bvs/report/view/:viewId", async (c) => {
  try {
    const viewId = c.req.param("viewId");
    const sm = (c.req.query("spendMode") ?? "totalImpact") as SpendMode;
    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);

    // Ship 4a: resolve (startDate, endDate) from explicit start/end params,
    // falling back to yearParam, then to anchorYear.
    const { startDate, endDate, isEnriched } = resolveDateRange(
      c.req.query("start"),
      c.req.query("end"),
      c.req.query("year"),
      anchorYear,
    );

    let result: any = null;

    // Parse viewId to determine the correct query
    if (viewId === "bvs-fac-root") {
      result = await buildFacilityRoot(sql, startDate, endDate, sm);
    } else if (viewId === "bvs-gl-root") {
      result = await buildGlRoot(sql, startDate, endDate, sm);
    } else if (viewId === "bvs-vendor-root") {
      result = await buildVendorRoot(sql, startDate, endDate, sm);
    } else if (viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor-(.+)-txn$/)) {
      const m = viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor-(.+)-txn$/)!;
      result = await buildFacilityGlVendorTxnDrill(sql, startDate, endDate, m[1], m[2], m[3], sm);
    } else if (viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor$/)) {
      const m = viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor$/)!;
      result = await buildFacilityGlVendorDrill(sql, startDate, endDate, m[1], m[2], sm);
    } else if (viewId.match(/^bvs-fac-(.+)-gl$/)) {
      const m = viewId.match(/^bvs-fac-(.+)-gl$/)!;
      result = await buildFacilityGlDrill(sql, startDate, endDate, m[1], sm);
    } else if (viewId.match(/^bvs-gl-(.+)-vendor-(.+)-txn$/)) {
      const m = viewId.match(/^bvs-gl-(.+)-vendor-(.+)-txn$/)!;
      result = await buildGlVendorTxnDrill(sql, startDate, endDate, m[1], m[2], sm);
    } else if (viewId.match(/^bvs-gl-(.+)-vendor$/)) {
      const m = viewId.match(/^bvs-gl-(.+)-vendor$/)!;
      result = await buildGlVendorDrill(sql, startDate, endDate, m[1], sm);
    } else if (viewId.match(/^bvs-vendor-(.+)-fac-(.+)-txn$/)) {
      const m = viewId.match(/^bvs-vendor-(.+)-fac-(.+)-txn$/)!;
      result = await buildVendorFacTxnDrill(sql, startDate, endDate, m[1], m[2], sm);
    } else if (viewId.match(/^bvs-vendor-(.+)-fac$/)) {
      const m = viewId.match(/^bvs-vendor-(.+)-fac$/)!;
      result = await buildVendorFacDrill(sql, startDate, endDate, m[1], sm);
    }

    if (!result) {
      console.log(`BVS view resolver: viewId=${viewId} resolved to null (entity not found or unrecognized pattern)`);
      return c.json({ error: `View resolved to null — entity not found for viewId: ${viewId}` }, 404);
    }

    // Ship 4a: legacy path gets the pre-4a shape (PPD stripped, no version
    // header). Enriched path retains PPD and stamps the response-shape header.
    if (isEnriched) {
      c.header("X-BVS-Response-Shape", "v2");
    } else {
      stripEnrichedFields(result);
    }

    return c.json(result);
  } catch (err: any) {
    console.log(`BVS report view error for viewId=${c.req.param("viewId")}: ${err?.message ?? err}`);
    console.log(`BVS stack: ${err?.stack ?? "no stack"}`);
    return c.json({ error: `BVS view error: ${err?.message ?? err}`, viewId: c.req.param("viewId") }, 500);
  }
});

// Preload root views for all three pivots
app.get("/make-server-b98afb97/bvs/report/roots", async (c) => {
  try {
    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);
    const { startDate, endDate, isEnriched } = resolveDateRange(
      c.req.query("start"),
      c.req.query("end"),
      c.req.query("year"),
      anchorYear,
    );
    const sm = (c.req.query("spendMode") ?? "totalImpact") as SpendMode;
    console.log(`BVS roots: building ${startDate}..${endDate} (enriched=${isEnriched})`);
    console.log(`BVS roots: sql pool acquired`);

    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // Build each root independently to isolate failures
    for (const [key, builder] of [
      ["bvs-fac-root", () => buildFacilityRoot(sql, startDate, endDate, sm)],
      ["bvs-gl-root", () => buildGlRoot(sql, startDate, endDate, sm)],
      ["bvs-vendor-root", () => buildVendorRoot(sql, startDate, endDate, sm)],
    ] as [string, () => Promise<any>][]) {
      try {
        console.log(`BVS roots: building ${key}...`);
        results[key] = await builder();
        console.log(`BVS roots: ${key} built with ${results[key]?.rows?.length ?? 0} rows`);
      } catch (err: any) {
        errors[key] = err?.message ?? String(err);
        console.log(`BVS roots: ${key} FAILED: ${errors[key]}`);
      }
    }

    if (Object.keys(results).length === 0) {
      return c.json({ error: `All root views failed`, errors }, 500);
    }

    // Ship 4a: strip/stamp based on enriched mode.
    if (isEnriched) {
      c.header("X-BVS-Response-Shape", "v2");
    } else {
      for (const viewResult of Object.values(results)) stripEnrichedFields(viewResult);
    }

    return c.json(results);
  } catch (err: any) {
    console.log(`BVS roots error: ${err?.message ?? err}`);
    return c.json({ error: `BVS roots error: ${err?.message ?? err}` }, 500);
  }
});

// BVS facility names
app.get("/make-server-b98afb97/bvs/report/facility-names", async (c) => {
  try {
    const sql = await getBvsSql();
    const names = await bvsGetFacilityNames(sql);
    return c.json(names);
  } catch (err: any) {
    console.log(`BVS facility names error: ${err?.message ?? err}`);
    return c.json({ error: `BVS facility names error: ${err?.message ?? err}` }, 500);
  }
});

// BVS anchor date — MAX(txn_date) from active transactions
app.get("/make-server-b98afb97/bvs/report/anchor-date", async (c) => {
  try {
    const sql = await getBvsSql();
    const [row] = await sql`SELECT MAX(txn_date) AS max_date FROM bvs.transactions`;
    let maxDate: string | null = null;
    if (row?.max_date) {
      const d = row.max_date;
      // Handle both Date objects and string representations
      if (d instanceof Date) {
        maxDate = d.toISOString().slice(0, 10);
      } else {
        // Try to parse as string — could be ISO or other format
        const parsed = new Date(String(d));
        if (!isNaN(parsed.getTime())) {
          maxDate = parsed.toISOString().slice(0, 10);
        } else {
          maxDate = String(d).slice(0, 10);
        }
      }
    }
    console.log(`BVS anchor date: ${maxDate}`);
    return c.json({ anchorDate: maxDate });
  } catch (err: any) {
    console.log(`BVS anchor date error: ${err?.message ?? err}`);
    return c.json({ error: `Anchor date error: ${err?.message ?? err}` }, 500);
  }
});

// BVS period breakdown — per-period (monthly/quarterly) spend/budget per entity
app.get("/make-server-b98afb97/bvs/report/view/:viewId/periods", async (c) => {
  try {
    const viewId = c.req.param("viewId");
    const viewBy = c.req.query("viewBy") ?? "monthly";
    const sm = (c.req.query("spendMode") ?? "totalImpact") as SpendMode;

    if (viewBy !== "monthly" && viewBy !== "quarterly") {
      return c.json({ error: `Invalid viewBy: ${viewBy}. Must be 'monthly' or 'quarterly'.` }, 400);
    }

    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);
    const { startDate, endDate } = resolveDateRange(
      c.req.query("start"),
      c.req.query("end"),
      c.req.query("year"),
      anchorYear,
    );

    console.log(`BVS periods: viewId=${viewId}, viewBy=${viewBy}, range=${startDate}..${endDate}, spendMode=${sm}`);
    const periods = await buildPeriodBreakdown(sql, viewId, viewBy, startDate, endDate, sm);
    console.log(`BVS periods: ${Object.keys(periods).length} entities returned`);

    return c.json({ viewId, viewBy, startDate, endDate, periods });
  } catch (err: any) {
    console.log(`BVS period breakdown error for viewId=${c.req.param("viewId")}: ${err?.message ?? err}`);
    return c.json({ error: `Period breakdown error: ${err?.message ?? err}` }, 500);
  }
});

// BVS sparkline data — trailing 12 months of monthly spend + budget per entity
app.get("/make-server-b98afb97/bvs/report/view/:viewId/sparklines", async (c) => {
  try {
    const viewId = c.req.param("viewId");
    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);
    // Sparklines are always trailing-12-from-year. If caller passes start/end,
    // use end's year as the anchor year; otherwise anchorYear.
    const endParam = c.req.query("end");
    let year = anchorYear;
    if (endParam && /^\d{4}-\d{2}-\d{2}$/.test(endParam)) year = Number(endParam.slice(0, 4));
    else if (c.req.query("year")) year = Number(c.req.query("year"));

    console.log(`BVS sparklines: viewId=${viewId}, year=${year}`);
    const sparklines = await buildSparklineData(sql, viewId, year);
    console.log(`BVS sparklines: ${Object.keys(sparklines).length} entities returned`);

    return c.json({ viewId, year, sparklines });
  } catch (err: any) {
    console.log(`BVS sparkline error for viewId=${c.req.param("viewId")}: ${err?.message ?? err}`);
    return c.json({ error: `Sparkline error: ${err?.message ?? err}` }, 500);
  }
});

// BVS diagnostic — minimal test of query module
app.get("/make-server-b98afb97/bvs/report/diag", async (c) => {
  const steps: Record<string, any> = {};
  try {
    steps.dbUrlSet = !!Deno.env.get("SUPABASE_DB_URL");
    const sql = await getBvsSql();
    steps.sqlPoolOk = true;

    const facRows = await sql`SELECT COUNT(*) AS cnt FROM bvs.facilities`;
    steps.facilityCount = Number(facRows[0]?.cnt ?? 0);

    const year = await getAnchorYear(sql);
    steps.anchorYear = year;
    const { start, end } = yearRange(year);
    steps.diagRange = `${start}..${end}`;

    // Try building just the facility root
    const facRoot = await buildFacilityRoot(sql, start, end);
    steps.facRootRowCount = facRoot?.rows?.length ?? 0;
    steps.facRootViewId = facRoot?.view?.id ?? null;
    steps.facRootKpiBudget = facRoot?.view?.kpi?.budget ?? null;

    return c.json({ status: "OK", steps });
  } catch (err: any) {
    steps.error = err?.message ?? String(err);
    steps.stack = err?.stack ?? null;
    console.log(`BVS diag error: ${steps.error}`);
    return c.json({ status: "ERROR", steps }, 500);
  }
});

// ---------------------------------------------------------------------------

Deno.serve(app.fetch);
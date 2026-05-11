BUG FIX — Transaction drill level (the 5th level: Facility → GL → Vendor → Transactions).

REPRO:
1. Select Timeframe = Month to Date, Metric = PPD
2. Click a Facility (e.g. Dogwood Assisted Living)
3. Click a GL (e.g. 6105 Dietary Equipment Rental)
4. Click a Vendor (e.g. Natus Medical - Mountain Region)
5. View the Transactions table

OBSERVED PROBLEMS:

Problem 1 — Transactions shown are from the wrong timeframe:
  Breadcrumb shows "Apr 1, 2026 – Apr 15, 2026"
  But 8 transactions are listed: INV-20251210, INV-20251110, INV-20250910, INV-20250710, INV-20250510, INV-20250410, INV-20250210, INV-20250110
  Zero of these fall within Apr 1–15, 2026. They span Jan–Dec 2025.
  The transactions query is pulling the vendor's FULL HISTORY, not the selected timeframe window.

Problem 2 — Every transaction Status = "Excluded":
  GL 6105 Dietary Equipment Rental is NOT in the excluded GL list (excluded GLs are 7200-7202, 7300-7302, 7400-7401).
  These are normal INVOICE transactions, not excluded items.
  The excluded styling template keeps re-appearing at new drill levels — same bug pattern we fixed at the vendor level earlier.

Problem 3 — Transaction-level PPD is meaningless:
  All Budget/Spend/Variance PPD columns show "--".
  KPI shows $0.00 / $0.00 / $0.00.
  This is actually correct behavior in a sense — per the PPD doctrine, PPD is an AGGREGATE metric (total spend ÷ total patient-days). A single invoice is a point-in-time event; "PPD of one invoice" is not a valid concept.
  But showing "--" across the whole drill makes the screen useless in PPD mode.

═══════════════════════════════════════
FIX 1 — Apply timeframe filter to transactions query
═══════════════════════════════════════

The transactions query must filter to the selected timeframe:

  SELECT * FROM bvs.transactions
  WHERE vendor_id = [vendor]
    AND gl_id = [gl]
    AND facility_id = [facility]
    AND txn_date >= [timeframe_start]
    AND txn_date <= [timeframe_end]
    AND status = 'ACTIVE'
  ORDER BY txn_date DESC;

For MTD Apr 1–15 2026, this should return ONLY transactions dated within that window. If Natus Medical had no transactions with Dogwood in GL 6105 during those 15 days, the table should show an empty state ("No transactions in selected timeframe") instead of expanding the query to the full history.

═══════════════════════════════════════
FIX 2 — Remove "Excluded" default status at transaction level
═══════════════════════════════════════

The transaction status should come from the transaction row's own properties, NOT from an inherited template:
  - If txn is on an excluded GL (7200-7202, 7300-7302, 7400-7401): Status = "Excluded"
  - If txn.status = 'ACTIVE' and GL is not excluded: Status should reflect the transaction type (e.g. "Posted", "Open PO", "Accrued") or simply not be displayed
  - Do NOT apply the excluded-template row styling (muted text) to normal transactions

Check the row rendering component — it's clearly inheriting an "excluded" flag or class from the vendor-view template. Set excluded=false explicitly for transaction rows.

═══════════════════════════════════════
FIX 3 — Handle PPD mode appropriately at transaction level
═══════════════════════════════════════

Transaction-level PPD is not a valid metric per doctrine. Two acceptable approaches:

OPTION A (RECOMMENDED): Show transaction detail in dollars regardless of the Metric selector, with a clear note.
  - Column headers: Transaction | Date | Amount | PO Reference | Status
  - Amount column shows dollar value (not PPD)
  - Header banner: "Showing transaction detail in dollars. PPD applies at vendor and above."
  - Remove the Budget PPD / Spend PPD / Variance PPD columns at this level

OPTION B: Disable the Transaction drill entirely when Metric = PPD.
  - Vendor rows remain clickable in Dollar mode
  - In PPD mode, vendor rows are not clickable (or show tooltip "Drill to transactions available in Dollar mode")

Choose Option A. It preserves the useful drill capability while being honest about what PPD means.

Also improve the transaction columns overall:
  - Transaction: show INV-XXXX or PO-XXXX reference as clickable link
  - Date: show txn_date (e.g. "Apr 8, 2026")
  - Amount: show dollar amount (e.g. "$485.00")
  - PO Reference: if txn_type = 'INVOICE', show related PO# if exists, otherwise "No PO"
  - Status: Posted / Open / Accrued / Excluded based on actual row data

═══════════════════════════════════════
VERIFICATION
═══════════════════════════════════════

After fix, at the transaction drill level with MTD Apr 1–15:
  ✓ All transactions shown are dated between Apr 1 and Apr 15, 2026
  ✓ No transactions from 2025 appear
  ✓ If vendor has no transactions in window, show empty state (not full history)
  ✓ Non-excluded-GL transactions render in normal text styling (not muted)
  ✓ Status column shows varied values (Posted, Open, etc.), not all "Excluded"
  ✓ In PPD mode, table shows dollar amounts with clear labeling (Option A), or drill is disabled (Option B)
  ✓ No "--" cells cluttering the table in PPD mode

IMPORTANT:
The root cause — "the query doesn't apply the timeframe filter" — is likely the SAME root cause as V1 (census scoping). Check whether the edge function has a general pattern of building queries without timeframe WHERE clauses. If so, a systematic pass across all edge function queries would prevent this class of bug from appearing at each new drill level.
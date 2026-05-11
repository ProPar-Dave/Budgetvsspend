# Prompt 39 - Extract Database Architecture for Budget vs Spend (Accrual-Ready)

You are now operating as a **data architect and backend systems designer**, not a UI builder.

Your job is to analyze the **existing data contract, repository layer, and transformation pipeline** and produce a **complete database architecture specification** that a developer can use to implement a real backend (e.g., Supabase / Postgres).

## Critical Context

The system already has:

- A **database-shaped seed layer** (Db* types)
- A **transformation layer** (Db → ReportView)
- A **repository/adapter boundary**
- A **stable payload contract** consumed by the UI (ReportView)

You must treat this as the **source of truth for schema design**.

---

## Objective

Produce a **developer-ready database architecture specification** that:

1. Defines all required tables
2. Defines relationships between them
3. Supports full drill path:
   - Facility → GL Account → Vendor → Transaction
4. Supports:
   - PPD + Dollars
   - Spend modes (Actual, Commitment, Total Impact)
   - Time buckets (daily grain)
   - Exclusions
   - KPI reconciliation
   - **Manual accruals as first-class transaction records**
5. Aligns with the **existing Db* types and ReportView contract**
6. Is directly implementable in **Postgres / Supabase**

---

## Non-Negotiable Rules

- Do NOT invent a new data model disconnected from the current codebase
- Do NOT simplify away drill hierarchy
- Do NOT treat accruals as optional or UI-only
- Do NOT collapse transactions into aggregates
- Everything must support **deterministic reconciliation**

---

## Required Output Sections

### 1. Core Tables

Define all tables required, including but not limited to:

- facilities
- gl_accounts
- vendors
- transactions
- transaction_lines (if needed)
- budgets (daily or decomposed)
- census_daily
- time_buckets (if persisted)
- exclusions
- accruals (or transaction_type extension)

For each table include:

- table name
- purpose
- columns (name, type, description)
- primary key
- foreign keys

---

### 2. Transaction Model (CRITICAL)

Define how transactions are modeled to support:

- PO
- Invoice
- PO + Invoice linkage
- **Manual accruals**

You must explicitly define:

- how transaction type is represented
- how accruals differ structurally (if at all)
- how “No PO” / “No Invoice” states are represented
- how commitment vs actual is derived

---

### 3. Relationships & Drill Path

Define how the schema supports:

Facility  
→ GL Account  
→ Vendor  
→ Transaction  

Include:

- join paths
- required indexes
- how aggregation is supported without duplication

---

### 4. Time & Grain Strategy

Define how the database supports:

- daily grain as system of truth
- period aggregation (weekly, monthly, custom)
- timeframe filtering

Be explicit about:

- whether budgets are stored daily or decomposed at runtime
- how census is stored and joined
- how timeBuckets in the payload are derived

---

### 5. KPI Derivation Strategy

Define how the following are computed from the database:

- Budget
- Consumed (Actual)
- Committed
- Variance
- Variance %

Clarify:

- what is precomputed vs computed at query time
- how reconciliation is guaranteed

---

### 6. Exclusion Model

Define how exclusions are represented and propagated:

- GL-level exclusion
- downstream propagation (vendor, transaction)
- impact on:
  - budget
  - spend
  - variance

---

### 7. PPD Support

Define how PPD is supported:

- relationship between spend and census
- how PersonDays are calculated
- when division occurs (DB vs transformation layer)

---

### 8. Manual Accrual Model (REQUIRED)

Define exactly how manual accruals exist in the database:

- Are they rows in `transactions` or a separate table?
- Required fields for an accrual
- How they impact:
  - spend
  - commitment
  - budget consumption
- How they are distinguished from invoices

This must align with the requirement that:
**accruals are first-class, DB-backed, transaction-level records**

---

### 9. Mapping to Existing Code

Map database tables → existing Db* types:

- DbRow
- DbTransaction
- DbCensusContext
- DbSpendComposition
- etc.

Then map:

Db* → ReportView

Show how the backend will cleanly feed the existing frontend without changes.

---

### 10. Example Rows (IMPORTANT)

Provide a small but realistic dataset:

- 1 facility
- 2 GL accounts
- 2 vendors
- 3–5 transactions including:
  - PO + Invoice
  - Invoice only
  - **Manual accrual**

Ensure:
- numbers reconcile
- hierarchy is valid

---

## Output Constraints

- Be precise and implementation-ready
- No UI discussion
- No vague statements
- No placeholders like “etc.”
- No skipping sections

---

## Goal

A backend engineer should be able to:

- create the schema
- load realistic data
- connect it to the existing repository layer
- achieve identical UI behavior

without redesigning the frontend
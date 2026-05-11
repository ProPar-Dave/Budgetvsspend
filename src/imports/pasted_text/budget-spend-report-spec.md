# Figma Make Instruction - Generate Comprehensive UI/UX Execution Requirements (Agent-Ready)

You are working on an **in-progress Budget vs Spend reporting prototype**.

Your task is to generate a **complete, agent-executable requirements document** that captures:

* ALL UI behavior
* ALL interactivity
* ALL frontend logic
* ALL data bindings
* ALL state transitions

This document will be used by an **agentic build system**.

If anything is ambiguous, inferred, or missing, the build will break.

---

# CRITICAL INSTRUCTION

This is NOT a design description.

This is a **deterministic execution specification**.

You must:

* eliminate ambiguity
* define behavior precisely
* avoid interpretation
* describe logic, not visuals

---

# SYSTEM CONTEXT

The system is a **Budget vs Spend reporting interface** with:

* hierarchical drill:
  Facility → GL Account → Vendor → Transaction
* governed data model:
  KPI (authoritative) + rows (display only)
* time-based aggregation
* pivot + breakdown capabilities

---

# REQUIRED OUTPUT STRUCTURE

Produce a single structured document with the following sections:

---

# 1. REPORT CONTEXT MODEL

Define:

* timeframe
* breakdownBy (time segmentation)
* pivotBy (Facility, GL, Vendor)
* metric (Dollars, PPD)
* spendMode (Actual, Committed, Net)

For EACH:

* allowed values
* default value
* how it affects:

  * KPI
  * table rows
  * drill behavior

---

# 2. KPI CONTRACT (NON-NEGOTIABLE)

Define EXACTLY:

KPI fields:

* budget
* consumed
* variance
* percent
* excludedSpend

Rules:

* variance = budget - consumed (always)
* consumed excludes excluded rows
* excludedSpend is separate and non-impacting

Define:

* how KPI changes when:

  * timeframe changes
  * drill level changes
  * pivot changes

Define:

* formatting rules
* conditional rendering (excludedSpend)

---

# 3. DATA BINDING CONTRACT

Define how UI binds to ReportView:

* reportContext
* kpi
* rows
* timeBuckets
* meta

For rows:

* required fields
* optional fields
* null handling
* excluded handling

Define:

* rows are NOT source of truth
* KPI is authoritative

---

# 4. TABLE BEHAVIOR (CRITICAL)

Define:

## Structure

* columns
* pinned columns
* scroll behavior

## Sorting

* allowed columns
* stable sorting rules
* tie-breaking behavior

## Filtering

* current filters (if any)
* how they apply

## Grouping

* based on pivot level
* how row hierarchy is constructed

## Row States

* normal
* excluded
* empty
* aggregated

---

# 5. DRILL-DOWN SYSTEM

Define EXACTLY:

Drill path:

* Facility → GL → Vendor → Transaction

For each level:

* what data is shown
* what changes in columns
* what remains constant

Define:

* how drill is triggered
* how drill state is stored
* how breadcrumb is constructed

---

# 6. TIME MODEL

Define:

* timeframe selection
* breakdown behavior
* timeBuckets mapping

Rules:

* daily grain is underlying truth
* periods are derived views

Define:

* how mixed periods are handled
* how aggregation occurs

---

# 7. METRIC SWITCH (DOLLARS vs PPD)

Define:

* how KPI values change
* how table values change
* formatting differences

Important:

* PPD is derived post-aggregation
* no recalculation at row level

---

# 8. SPEND MODE BEHAVIOR

Define:

* Actual
* Committed
* Net

For each:

* what data is included
* how KPI changes
* how rows change

---

# 9. EXCLUDED LOGIC

Define:

Row-level:

* excluded rows:

  * budget = 0
  * variance = null
  * still visible

KPI-level:

* excludedSpend aggregation
* does NOT affect:

  * consumed
  * variance

Define:

* how excluded rows are styled
* how they appear in drill

---

# 10. STATE MANAGEMENT

Define:

* what is stored in state:

  * reportContext
  * drill state
  * sorting
  * filters

Define:

* how state changes propagate
* what triggers re-render

---

# 11. PERFORMANCE BEHAVIOR

Define:

* virtualization expectations
* large dataset handling
* re-render constraints

---

# 12. EDGE CASES (MANDATORY)

Explicitly define behavior for:

* no data
* zero budget
* zero spend
* excluded-only views
* identical values
* large transaction sets
* partial timeframes

---

# 13. NON-NEGOTIABLE RULES

List all invariants:

* KPI is NOT derived from rows
* rows must reconcile to KPI
* no business logic in UI
* aggregation happens in data layer only

---

# OUTPUT REQUIREMENTS

* Use structured sections
* Use deterministic language (MUST, SHALL, NEVER)
* No design commentary
* No suggestions
* No ambiguity

---

# GOAL

This document must allow an agent to:

* rebuild the UI from scratch
* without interpretation
* with identical behavior

---

Generate the full document.

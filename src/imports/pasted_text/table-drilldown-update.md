You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not modify columns, controls, styling, or layout unless instructed.

You are only updating interaction behavior.

---

OBJECTIVE

Replace the current inline expandable detail row behavior with a true drilldown interaction model.

---

CHANGES TO IMPLEMENT

1. REMOVE EXPANDABLE ROW BEHAVIOR

- Remove the expand/collapse toggle button (▶ / ▼) from the first cell
- Remove the expanded row rendering (detail panel row)
- Remove any dependency on:
  - getExpandedRowModel
  - expanded state
  - detail panel rendering logic

After this change:
- No rows should expand inline
- Table should render only one row per data item

---

2. ADD ROW CLICK DRILL INTERACTION

- Entire row becomes clickable
- Clicking a row triggers a drill event

Implement:

- Add onClick handler to each row
- Emit an audit/log event:
  DRILL_DOWN

Payload must include:
- current row identifier (e.g., category name for now)
- current level (hardcode as "LEVEL_0" for now)

Example:
{
  type: "DRILL_DOWN",
  level: "LEVEL_0",
  target: row.original.category
}

---

3. VISUAL FEEDBACK FOR CLICKABLE ROWS

- Add hover state to rows:
  - subtle background change
  - cursor: pointer

Do NOT:
- add icons
- add buttons
- add new columns

---

4. DO NOT IMPLEMENT REAL DRILL YET

Important:
- Do NOT change the dataset
- Do NOT load new data
- Do NOT simulate next level

This step is ONLY about:
- replacing expand behavior
- introducing drill interaction

---

5. PRESERVE EVERYTHING ELSE

Do NOT change:
- columns
- sorting
- filtering
- density controls
- layout
- styling (except hover state)

---

6. OUTPUT

After implementing, return:

1. WHAT WAS REMOVED
2. WHAT WAS ADDED
3. CONFIRMATION THAT:
   - No expand behavior remains
   - Rows are now clickable
   - Drill event fires correctly

Do not propose next steps.

Stop after reporting changes.
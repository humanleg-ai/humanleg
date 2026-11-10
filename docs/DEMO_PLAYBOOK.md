# HumanLeg demo playbook

These are illustrative synthetic demos, not claims of live marketplace availability.

## 1. Retail stock check

An agent creates a bounded request to verify whether a publicly displayed item appears to be in
stock. Evidence: timestamped shelf photo and a structured yes/no result. No purchase is requested.

## 2. Exterior visual inspection

An agent describes a non-sensitive exterior feature and asks for rubric-based photos. Evidence:
required angles plus a checklist. No entry, surveillance or identity collection is allowed.

## 3. Document pickup planning

An agent models a future document or key pickup task using synthetic names and locations. The public
sandbox stops before funding or worker dispatch.

## 4. Event readiness check

An agent supplies a venue checklist and asks for structured verification of visible setup items.
Evidence: checklist results and illustrative public-space photos.

## 5. Local public-information verification

An agent asks a person to confirm a public sign, opening notice or accessibility feature and return
the observation in a defined schema.

## Demo sequence

Each demo should visibly follow the same trust flow:

`agent → quote → exact-content compliance review → human step (illustrative) → evidence → webhook`

The hosted sandbox implements the first three steps only. Production human dispatch remains gated.

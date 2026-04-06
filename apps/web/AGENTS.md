<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Roles & Delegation

## Authority Hierarchy

| Agent | Role | Authority |
|-------|------|-----------|
| **Samer** (Founder) | Approves IMMUTABLE + STRONG DEFAULT changes, business logic, pricing, methodology | Final decision maker |
| **Rafik** (CEO/Chief of Staff) | Orchestrates task routing, multi-agent coordination, strategic review | NEVER implements. Never writes code. |
| **Sani** (CTO — Claude) | Executes architecture, integration, RTL, security, Supabase, payments | Can make NEGOTIABLE decisions. Must escalate STRONG DEFAULT. |
| **Junior** (qwen3-coder via Ollama) | Boilerplate, repetitive code, config, CSS, test files, component stubs | NONE. Follows atomic specs only. Output MUST be reviewed by Sani. |

## Delegation Table

| Delegate to Junior | Keep with Sani |
|---|---|
| HTML shells, CSS resets, component stubs | Architecture decisions |
| Repetitive CRUD, utility functions | Security-sensitive logic (auth, RLS, payments) |
| Test files, config files | Arabic/RTL layout validation |
| Product/course/event card components | API integration (Stripe, Tabby, Supabase) |
| Form layouts, input validation UI | Migration scripts, data transformation |
| Filling well-defined subtasks from spec | Code review of ALL Junior output |

## Code Review Rubric

Before ANY code ships to main, review against these criteria:

| Criterion | Check |
|---|---|
| Correctness | Does it do what the task contract says? |
| Security | No XSS, no SQL injection, no exposed secrets, RLS enforced? |
| Localization | Both AR/EN strings present? RTL renders correctly? |
| Performance | No unnecessary re-renders? Images optimized? Lazy loading? |
| Accessibility | WCAG 2.1 AA? Focus states? Screen reader labels? |
| Brand fidelity | Only 6 colors? Correct typography? Correct spacing? |
| Mobile-first | Works at 390px? Touch targets 44px+? |
| Type safety | Zero TypeScript errors? Proper types (not `any`)? |

## Wave Isolation Rules

On any wave spanning 3+ files or 2+ hours:
1. Break into dependency-aware sub-tasks
2. Each sub-task runs in a focused context (not accumulated conversation)
3. Pass only STATE SUMMARY forward, not full prior conversation
4. Sub-task N never starts until N-1 is committed and verified
5. Update the wave file between sub-tasks

## Uncertainty Protocol

| Situation | Action |
|-----------|--------|
| Requirements ambiguous | STOP. Present 2 options with trade-offs to Samer. Wait. |
| Payment logic unclear | STOP. Escalate immediately. Never guess payment flows. |
| Migration data inconsistent | Create discrepancy report. Do NOT silently merge/discard. |
| UI conflicts with brand rules | Present both options (brand-pure vs practical) to Samer. |
| Blocked by credentials | Build with mock adapters. Flag as blocked. Continue non-dependent work. |
| Two rules conflict | Higher hierarchy wins: IMMUTABLE > STRONG DEFAULT > NEGOTIABLE. Same level = escalate to Samer. |

## Universal Rules
- Never fabricate business logic
- Never silently change scope
- Never expose credentials in code, logs, comments, docs, or generated artifacts
- When uncertain, choose the safest reversible path
- Produce a blocker note with options A/B/C rather than guessing

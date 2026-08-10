# AI Forms — User Testing Guide

This guide helps a human tester confirm that AI Forms work correctly on staging.

**Testers needed:** One person with Super Admin access.

**Time required:** About 30 minutes.

---

## Quick Reference

| Step | Who | Where to Go | What to Do | Expected |
|------|-----|-------------|------------|----------|
| A1 | Super Admin | Platform → Forms | Click "New Form" → "Generate with AI" | AI creates form + questions |
| A2 | Super Admin | Forms → open form → AI Eval tab | Turn ON "Enable AI Evaluation" | Toggle saved |
| A3 | Super Admin | Platform → Runs → New Form Run | Create run for the form | Run created with URL |
| A4 | Public User | Open form URL in new browser | Fill and submit form | "Submission Received" page |
| A5 | Super Admin | Platform → Runs → open run | Click "Evaluate All" | Submissions evaluated |
| A6 | Super Admin | Runs → Responses tab → click Review | Review submission | AI scores shown |
| B1 | Super Admin | Platform → Forms → New Form | Create form manually, skip AI Eval | Normal form created |
| B2 | Super Admin | Platform → Runs | Create run, submit test | No AI evaluation triggered |

---

# TEST SCENARIO A — AI Evaluation ON

## Step A1 — Generate a Form with AI

**Who:** Super Admin

**Where:** Sidebar → **Platform** → **Forms**

**What to do:**

1. Click the orange **New Form** button.
2. Click the **Generate with AI** tab.
3. Copy and paste this prompt into the text box:

```
Create an assessment form for a startup incubation program. Include sections for:

1. Founder Background (name, email, phone, years of experience, previous startups)
2. Business Idea (describe your idea, what problem it solves, target market)
3. Score each answer from 1-10

Evaluation criteria:
- Clarity of business idea (40%)
- Founder experience and track record (35%)
- Market understanding (25%)

Scoring: 90-100 = Outstanding, 80-89 = High Potential, 70-79 = Promising, 60-69 = Needs Work, 0-59 = Not Ready
```

4. Click **Generate**.
5. Wait a few seconds. The AI will create the form.
6. The form opens in the builder automatically.

**What you should see:**
- The form has sections (Founder Background, Business Idea, Assessment)
- Each section has fields (name, email, phone, textareas, rating questions)
- The form title is something like "Startup Assessment"

**Check:** PASS if form has at least 2 sections with questions. FAIL if empty.

**Result:** PASS / FAIL

---

## Step A2 — Enable AI Evaluation

**Who:** Super Admin

**Where:** Form Builder (already open from Step A1)

**What to do:**

1. Click the purple **AI Eval** tab at the top.
2. You should see the evaluation framework the AI generated (dimensions, weights, rankings).
3. Check the checkbox: **☑ Enable AI Evaluation**
4. You should see a notification: "AI evaluation enabled".
5. If weights don't total 100%, edit them until they do.
6. Click **Save Framework**.

**What you should see:**
- Checkbox is checked
- Green notification "AI evaluation enabled"
- Framework shows dimensions with weights that sum to 100%
- A green message "✓ Weights total 100% — ready to save"

**Check:** PASS if checkbox stays checked and framework saved. FAIL if checkbox doesn't stay checked.

**Result:** PASS / FAIL

---

## Step A3 — Launch the Form

**Who:** Super Admin

**Where:** Platform → **Runs**

**What to do:**

1. Click **Runs** in the sidebar.
2. Click **New Form Run**.
3. Select the form you just created from the dropdown.
4. Give it a name like "Test Run".
5. Optionally assign it to a group.
6. Click **Create Run**.
7. Click the run to open it.
8. Click the **Share** tab.
9. Copy the public link (starts with your domain followed by `/s/`).

**What you should see:**
- The run appears in the list
- The Share tab shows a public URL
- Status says "Active"

**Check:** PASS if you have a working URL that starts with `/s/`. FAIL if no URL.

**Result:** PASS / FAIL

---

## Step A4 — Submit a Test Response (as Public User)

**Who:** Public User (open in a new browser window or incognito)

**Where:** The public URL from Step A3

**What to do:**

1. Open the URL in a **different browser** or **incognito window** (so you're not logged in as admin).
2. You should see the Future Studio logo at the top and the form below.
3. Fill in all required fields (marked with *).
4. Use a test email like `testuser@example.com`.
5. Click **Submit**.

**What you should see:**
- "Submission Received" page with green checkmark
- Future Studio logo and contact email at the bottom
- Message says your application has been received

**Check:** PASS if you see the success page. FAIL if error or nothing happens.

**Result:** PASS / FAIL

---

## Step A5 — Confirm AI Evaluation Ran

**Who:** Super Admin (back in main browser)

**Where:** Platform → **Runs** → open your test run

**What to do:**

1. Go to the **Responses** tab.
2. Find your test submission in the table.
3. Look at the timeline — there should be an "ai_evaluated" entry OR the review page should show AI scores.

**Alternative — Check via Review:**
4. Click the **Review** button next to your submission.
5. In the review modal, scroll down to the **AI Evaluation** section.
6. You should see: Overall score, dimension scores, reasoning, confidence %.

**What you should see:**
- A section titled "AI Evaluation" with purple header
- Overall score (e.g., 82%)
- A table with each dimension and its AI score
- Reasoning text explaining the score
- Confidence percentage

**Check:** PASS if AI Evaluation section appears with scores. FAIL if empty or missing.

**Result:** PASS / FAIL

---

## Step A6 — Test Batch Evaluation

**Who:** Super Admin

**Where:** Platform → **Runs** → your test run

**What to do:**

1. Submit **2-3 more** responses using the public form (repeat Step A4 with different test emails).
2. Back in the run detail, click the purple **Evaluate All** button in the header.
3. Wait for the notification showing how many were evaluated.
4. Check that each new submission now has AI evaluation results.

**What you should see:**
- Purple "Evaluate All" button in the header (only for active runs)
- Notification: "Evaluated 3 submissions"
- Each new submission shows AI evaluation in Review

**Check:** PASS if batch evaluates all submissions. FAIL if button missing or doesn't work.

**Result:** PASS / FAIL

---

# TEST SCENARIO B — AI Evaluation OFF

## Step B1 — Create a Normal Form

**Who:** Super Admin

**Where:** Platform → **Forms** → **New Form** → **Create Manually**

**What to do:**

1. Click **New Form**.
2. Stay on the **Create Manually** tab.
3. Name it "Test Form - No AI".
4. Click **Create**.
5. Add a few simple fields (Name, Email, Message).
6. **Do NOT** go to the AI Eval tab. Leave it alone.
7. Click **Publish**.

**What you should see:**
- Form published successfully
- No AI evaluation framework
- No purple AI indicators

**Check:** PASS if form created without AI. FAIL if forced to add AI.

**Result:** PASS / FAIL

---

## Step B2 — Launch and Submit

**Who:** Super Admin → then Public User

**Where:** Platform → **Runs** → New Form Run

**What to do:**

1. Create a run for this form (same as Step A3).
2. Open the public URL and submit a response.
3. Back in the run detail, click **Review** on the submission.
4. Check for any AI evaluation.

**What you should see:**
- Submission stored normally
- **NO** AI Evaluation section in the review modal
- **NO** "Evaluate All" button appears

**Check:** PASS if no AI evaluation appears. FAIL if AI evaluation unexpectedly appears.

**Result:** PASS / FAIL

---

# BUG REPORT FORMAT

If something fails:

---

**BUG TITLE:** _Short description_

**USER / ROLE:** Public User / Super Admin

**DASHBOARD:** e.g., Platform / Forms

**ACTION:** What you were trying to do

**WHAT I DID:**
1. ...
2. ...

**EXPECTED:** What should happen

**ACTUAL:** What actually happened

**RESULT:** FAIL

---

# FINAL CHECKLIST

| Test | Result |
|---|---|
| AI can generate a Form | |
| Generated Form can be reviewed/edited | |
| AI Evaluation can be enabled per Form | |
| AI-enabled Form can be launched | |
| Public Form works and shows branding | |
| Response is stored | |
| AI evaluation runs after submission | |
| AI evaluation is displayed in Review | |
| Scores, reasoning, and confidence are shown | |
| Batch evaluation works | |
| Normal Form (AI OFF) works | |
| Normal Form does NOT trigger AI evaluation | |
| Both Form types work independently | |

---

**Tester Name:** ________________

**Date:** ________________

**Overall Result:** PASS / FAIL

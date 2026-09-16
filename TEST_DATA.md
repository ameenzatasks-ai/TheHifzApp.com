# Student Progress Interface - Test Data

This document describes test scenarios for the updated student progress interface with new status labels and colors.

## Test Data Scenarios

### Scenario 1: Complete Student Progress Progression
A student advancing through all memorization stages from beginning to completion.

```
Student: Ahmed Ali
Class: Quran Mastery 2026
Pages in each status:

- Ready for Test 1 (BLACK - #FF2D2D): Pages 1-5
  Label: "Ready for Test 1"
  Description: "I have listened to this page once and checked the Tajweed rules."
  
- Test 1 Passed (RED - #00E1FF): Pages 6-15
  Label: "Test 1 Passed"
  Description: "I am now practising it 18 times, with tests in between, before taking my final test with the Ustaz."
  
- Ready for Final Test (AMBER - #FF6600): Pages 16-25
  Label: "Ready for Final Test"
  Description: "I have completed the practice and am now waiting for the Ustaz to test me."
  
- Ready to Memorize (GREEN - #00E64A): Pages 26-40
  Label: "Ready to Memorize"
  Description: "The Ustaz has tested me for a final time, and I can memorise this page when I am ready."
  
- Memorized (GOLD - #FFC72E): Pages 41-60
  Label: "Memorized"
  Description: "Memorized in Sabaq"
  
- Retest Needed (YELLOW - #9CA3AF): Pages 61, 70, 85
  Label: "Retest Needed"
  Description: "Ten days have passed since the final test — needs re-testing"
```

### Scenario 2: Beginning Student
A student just starting their memorization journey.

```
Student: Fatima Hassan
Class: Beginner's Quran
Pages in each status:

- Ready for Test 1 (BLACK): Pages 1-20
- All other statuses: Empty
```

### Scenario 3: Advanced Student with Mixed Progress
A student with pages at all stages including retests needed.

```
Student: Muhammad Omar
Class: Advanced Hifz
Pages in each status:

- Ready for Test 1: Pages 1-3, 100-105
- Test 1 Passed: Pages 4-10, 110-115
- Ready for Final Test: Pages 11-20, 120-130
- Ready to Memorize: Pages 21-50
- Memorized: Pages 51-99, 131-200
- Retest Needed: Pages 31, 45, 67, 90, 155
```

## Visual Verification Checklist

When viewing the StudentDetail page with student progress, verify:

### Status Labels (Palette Changes)
- [ ] BLACK status shows "Ready for Test 1" (not "Listened")
- [ ] RED status shows "Test 1 Passed" (not "Practiced")
- [ ] AMBER status shows "Ready for Final Test" (not "In Practice")
- [ ] GREEN status shows "Ready to Memorize" (not "Test 2 Completed")
- [ ] GOLD status shows "Memorized" (capitalization updated)
- [ ] YELLOW status shows "Retest Needed" (not "Re-test needed")

### Status Descriptions
- [ ] BLACK: "I have listened to this page once and checked the Tajweed rules."
- [ ] RED: "I am now practising it 18 times, with tests in between, before taking my final test with the Ustaz."
- [ ] AMBER: "I have completed the practice and am now waiting for the Ustaz to test me."
- [ ] GREEN: "The Ustaz has tested me for a final time, and I can memorise this page when I am ready."
- [ ] GOLD: "Memorized in Sabaq"
- [ ] YELLOW: "Ten days have passed since the final test — needs re-testing"

### Color Verification
- [ ] YELLOW (Retest Needed) is now **neutral gray** (#9CA3AF) instead of metallic silver
- [ ] All colors render correctly in **light mode**
- [ ] All colors render correctly in **dark mode** (if implemented)
- [ ] Text contrast meets WCAG AA standards for all status colors

### Navigation & UX
- [ ] Summary section (GroupedPages) displays at top of Nazira tab
- [ ] JuzGrid displays directly below summary without separate tab
- [ ] No scrolling required to see both summary and grid start
- [ ] GroupedPages shows page ranges: "1–3", "5" format
- [ ] Clicking AMBER status tiles opens practice counter modal
- [ ] Practice counter correctly transitions pages to GREEN on completion

### Loading States
- [ ] Initial load shows spinner until data arrives
- [ ] Empty state displays: "No pages have a status set yet."
- [ ] Data persists after navigation between students
- [ ] Page updates (status changes) are reflected immediately
- [ ] No stale/blank UI during page transitions

### PageEditor Modal
When opening PageEditor (clicking a page tile):
- [ ] All 6 status cards display with updated labels
- [ ] Descriptions show updated text
- [ ] Each status card shows correct color from PALETTE
- [ ] Listen button appears next to "Ready for Test 1" (BLACK) card
- [ ] Current status is highlighted with "Current" badge

## Test Execution Steps

### Step 1: Authenticate
```
Email: ustadh@nazirah.app (or create test account)
Password: password123
```

### Step 2: Navigate to Class
1. Go to "Classes" section
2. Select a class with student(s)
3. Verify class loads without errors

### Step 3: View Student Progress
1. Click on a student name
2. Verify student name appears in header
3. Wait for data to load (initial spinner should display)
4. Verify no errors in console

### Step 4: Verify GroupedPages (Summary)
1. Look at grouped pages section at top
2. For each status with pages, verify:
   - Label matches requirements
   - Description is accurate
   - Colors render correctly
   - Page ranges display (e.g., "1–3", "5")
   - Count badge shows correct page count

### Step 5: Verify JuzGrid
1. Scroll to view the full grid
2. Verify pages display with correct status colors
3. Click a page tile in AMBER status
4. Verify PageEditor opens with correct information
5. Verify practice counter modal works if AMBER is selected

### Step 6: Test Navigation
1. Switch between students using tabs
2. Switch between Nazira and Hifz modes
3. Verify data loads correctly each time
4. Verify previous student's data is cleared

### Step 7: Test Dark/Light Mode (if implemented)
1. Toggle theme in settings/preferences
2. Verify all colors remain accessible and clear
3. Verify text contrast is maintained
4. Verify YELLOW (gray) remains distinct in both modes

## Expected Outcomes

### Before Changes
- Students see confusing labels like "Listened", "Practiced", "In Practice"
- The progression of stages was unclear
- YELLOW status appeared as a metallic silver color

### After Changes
- Each label clearly communicates what the student has accomplished
- Next action is obvious from the description
- Status progression is intuitive: Ready → Test Passed → Ready for Test → Ready to Memorize → Memorized
- YELLOW is now clearly a neutral gray indicating a retest is needed
- All descriptions use student-friendly language

## Notes on Color Updates

### Palette Color Changes for YELLOW (Retest Needed)
```javascript
// Before (Metallic Silver)
fill:      '#BFC4CB',
accent:    '#6F7883',
iconBg:    '#E1E5EA',
iconColor: '#3A414B',
text:      '#23272D',

// After (Neutral Gray)
fill:      '#9CA3AF',
accent:    '#6B7280',
iconBg:    '#D1D5DB',
iconColor: '#374151',
text:      '#1F2937',
```

The new neutral gray palette:
- Provides better contrast and accessibility
- Is more universally recognized as "neutral" or "pending"
- Maintains consistency with modern design systems
- Renders correctly in both light and dark modes

## Regression Testing

Verify these existing features still work after changes:

- [ ] StudentDetail loads without errors
- [ ] GroupedPages groups pages correctly by status
- [ ] JuzGrid displays all 604 pages in correct order
- [ ] PageEditor modal opens/closes correctly
- [ ] Practice counter modal shows for AMBER selection
- [ ] Page status updates persist to database
- [ ] Student switching works smoothly
- [ ] Nazira/Hifz mode toggle works
- [ ] Previous Nazira logs button works
- [ ] Scores tab loads for Hifz mode

## Browser & Platform Verification

Test on:
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)
- [ ] Desktop (1920x1080 minimum)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x812)

# Insurance Plan Comparison Page

A responsive insurance plan comparison page built with Next.js, TypeScript, and Tailwind CSS.

## Live Demo

**[→ Launch Application](https://insurance-plan-comparison-page.vercel.app)**

## Estimated Timeline

| Task                             | Time     |
| -------------------------------- | -------- |
| Requirement analysis             | 20 min   |
| Data modeling & component design | 30 min   |
| UI implementation                | 90 min   |
| Responsive optimization          | 20 min   |
| Testing & polishing              | 20 min   |
| Total                            | ~3 hours |

## Features

- Side-by-side comparison of Bronze, Silver, and Gold plans
- Visual indicators for included and excluded benefits
- Automatic highlighting of the best value in each comparison row
- Recommended plan badge based on value-for-money ratio
- Responsive layout optimized for desktop and mobile
- Clean and professional insurance-focused UI

## Approach

### Data-Driven Design

The comparison table is generated from structured plan data rather than hardcoded values. This makes it easy to add or modify plans in the future.

### Best Value Highlighting

Each comparison row calculates the strongest offering automatically:

- Highest coverage limits
- Lowest copay percentage
- Shortest waiting period
- Included benefits over unavailable benefits

### Recommended Plan Logic

A recommendation score is calculated based on:

- Coverage limits
- Included benefits
- Copay percentage
- Waiting period
- Monthly premium

This balances both coverage quality and affordability.

### Responsive Strategy

#### Desktop

- Three plans displayed side-by-side
- Easy row-by-row comparison

#### Mobile

- Plans stack vertically
- Maintains readability without horizontal scrolling

````

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS

## Running Locally

```bash
npm install
npm run dev
````

Open:

```text
http://localhost:3000
```

## AI Usage

AI tools were used to assist with:

- Requirement breakdown
- Component structure planning
- UI refinement
- Responsive layout improvements
- Documentation generation

All generated code was reviewed, adjusted, and validated manually before submission.

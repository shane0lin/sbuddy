# AMC Problem Viewer - Improvements and Fixes

## Overview

This document tracks all improvements and fixes made to the AMC Problem Viewer to ensure proper display of LaTeX equations, diagrams, and answer choices.

## Problems Fixed

### 1. LaTeX Rendering Support ✅

**Issue**: LaTeX equations were not rendering properly in the viewer.

**Solution**:
- Added MathJax v3 configuration to `public/viewer/problem.html`
- Configured support for both inline math (`$...$`) and display math (`\[...\]`)
- Added polling mechanism to wait for MathJax to load before rendering

**Files Modified**:
- `public/viewer/problem.html`: Lines 8-19 (MathJax config)
- `public/viewer/problem.html`: Lines 474-495 (MathJax loading handler)

### 2. Protocol-Relative URL Handling ✅

**Issue**: Image URLs like `//latex.artofproblemsolving.com/...` were broken (404 errors).

**Solution**:
- Updated `extractImages()` to properly handle protocol-relative URLs
- Convert `//` prefix to `https:`

**Files Modified**:
- `src/services/aopsScraper.ts`: Lines 356-363 (URL conversion logic)

### 3. Inline Equation Images ✅

**Issue**: Inline LaTeX equations (like `$-2$`, `$5$`) were showing as separate images, cluttering the display.

**Solution**:
- Modified scraper to only capture answer choices images, not inline equations
- Inline equations are now rendered by MathJax from the text content
- Added `answerChoicesImage` field to separate answer choices from other images

**Files Modified**:
- `src/services/aopsScraper.ts`: Lines 5-17 (AMCProblem interface)
- `src/services/aopsScraper.ts`: Lines 341-390 (extractImages refactor)
- `public/viewer/problem.html`: Lines 436-441 (display answerChoicesImage)

### 4. Solution Text Extraction ✅

**Issue**: Solutions were mixing content from multiple solutions, not properly separated.

**Solution**:
- Updated `extractSolutions()` to use `h2` selectors and `nextUntil()`
- Each solution now gets only its own content between headings
- LaTeX is preserved using `extractTextWithLatex()`

**Files Modified**:
- `src/services/aopsScraper.ts`: Lines 199-212 (extractSolutions method)

### 5. Asymptote Diagram Support ✅

**Issue**: Asymptote diagrams (e.g., `[asy]...`) were showing as raw code instead of images.

**Solution**:
- Added detection of Asymptote diagram images in `extractTextWithLatex()`
- Replace `[asy]...[/asy]` images with `[DIAGRAM: URL]` markers
- Added `formatSolutionWithDiagrams()` in viewer to convert markers to `<img>` tags

**Files Modified**:
- `src/services/aopsScraper.ts`: Lines 177-187 (Asymptote detection)
- `public/viewer/problem.html`: Lines 378-385 (formatSolutionWithDiagrams)
- `public/viewer/problem.html`: Line 401, 466 (apply to solutions and content)

### 6. Display Math Support ✅

**Issue**: Display math equations (using `\[...\]`) were missing from solutions.

**Solution**:
- Updated `extractTextWithLatex()` to handle both `$...$` and `\[...\]` delimiters
- Added `\[...\]` to MathJax displayMath configuration

**Files Modified**:
- `src/services/aopsScraper.ts`: Lines 189-197 (LaTeX extraction)
- `public/viewer/problem.html`: Line 12 (MathJax displayMath config)

### 7. Problem Diagram Support ✅

**Issue**: Diagrams in problem statements (e.g., Problem 15) were not showing.

**Solution**:
- Updated `extractProblemContent()` to capture ALL content until Solution heading
- This includes diagrams in `<center>` tags between problem text and answer choices
- Applied `formatSolutionWithDiagrams()` to problem content

**Files Modified**:
- `src/services/aopsScraper.ts`: Lines 157-188 (extractProblemContent refactor)
- `public/viewer/problem.html`: Line 466 (apply diagram formatting)

## Data Structure Changes

### AMCProblem Interface

```typescript
export interface AMCProblem {
  year: number;
  test: 'A' | 'B';
  problemNumber: number;
  content: string;
  solutions: string[];
  choices?: string[];
  answer?: string;
  topics?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  seeAlso?: string[];
  images?: string[];                    // Now empty (inline equations removed)
  answerChoicesImage?: string;          // NEW: Dedicated answer choices image
}
```

## Testing Checklist

- [x] Problem 1: Answer choices display correctly
- [x] Problem 3: No extra inline equations shown
- [x] Problem 3 Solution 1: Asymptote diagram displays properly
- [x] Problem 4: LaTeX equations render via MathJax
- [x] Problem 13 Solution 1: Display math equation shows after "is defined as:"
- [x] Problem 15: Problem diagram displays in problem statement

## Performance Improvements

- **File size**: Reduced from 0.30 MB to 0.09 MB by removing inline equation images
- **Image count**: Reduced from 34 images per problem to 0-1 (answer choices only)
- **Rendering**: MathJax renders inline equations from text (faster than loading images)

## Known Limitations

1. **Asymptote diagrams**: Displayed as pre-rendered PNG images, not interactive SVG
2. **Answer choices text**: Included in problem content text (in addition to image)
3. **MathJax loading**: May have brief delay on first page load

## Future Enhancements

- [ ] Add SVG rendering for Asymptote diagrams
- [ ] Implement diagram zoom/lightbox functionality
- [ ] Cache MathJax for faster subsequent loads
- [ ] Add print stylesheet with proper equation rendering

## Related Files

- `src/services/aopsScraper.ts` - Web scraper with LaTeX/diagram handling
- `public/viewer/problem.html` - Problem detail page with MathJax
- `public/viewer/index.html` - Main problem list page
- `scripts/crawl2012AMC10A.ts` - Crawler script
- `crawled_data/amc_2012_10a_problems.json` - Crawled data (0.09 MB)

## Crawl Statistics

- **Total problems**: 25
- **Problems with solutions**: 25/25
- **Problems with answer choices images**: 25/25
- **Average solutions per problem**: 3.5
- **Data file size**: 0.09 MB (formatted)

---

**Last Updated**: October 19, 2025
**Status**: All major issues resolved ✅

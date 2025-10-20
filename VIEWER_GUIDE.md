# AMC Problems Viewer - Complete Guide

## Overview

The AMC Problems Viewer is a web-based interface for browsing and studying crawled math competition problems. It provides an intuitive, interactive way to explore problem sets with filtering, navigation, and detailed views.

## ✅ What's Been Built

### 1. Data Collection ✅
- **Crawled**: All 25 problems from 2012 AMC 10A
- **Saved to**: `crawled_data/amc_2012_10a_problems.json` (0.09 MB)
- **Data includes**: Problem statements, multiple solutions, difficulty levels, topics, diagrams
- **LaTeX support**: Inline math (`$...$`) and display math (`\[...\]`)
- **Diagram support**: Asymptote diagrams rendered as images

### 2. Web Interface ✅
- **Main Page**: Browse all problems with filtering
- **Detail Page**: View individual problems with full details
- **LaTeX Rendering**: MathJax v3 for beautiful equation rendering
- **Diagram Display**: Asymptote diagrams and answer choices as images
- **Responsive Design**: Works on desktop and mobile

### 3. Server ✅
- **Express.js server**: Serves static files and provides API endpoints
- **Port**: 13001 (configurable)
- **Auto-restart**: Use `npm run serve:viewer`

## Quick Start

### Step 1: Verify Data Exists

```bash
ls -lh crawled_data/amc_2012_10a_problems.json
```

**Expected output**: `0.09 MB` file

### Step 2: Start the Server

```bash
npm run serve:viewer
```

**Expected output**:
```
🚀 AMC Problem Viewer Server Started!
📊 Server running at: http://localhost:13001
```

### Step 3: Open in Browser

Visit: **http://localhost:13001/viewer/index.html**

## Features Walkthrough

### Main Page Features

**1. Metadata Display**
- Year: 2012
- Test: AMC 10A
- Total Problems: 25
- Average Solutions: 3.5
- Difficulty Distribution:
  - Easy: 10 problems (1-10)
  - Medium: 10 problems (11-20)
  - Hard: 5 problems (21-25)

**2. Filter Controls**
- **All Problems**: Shows all 25 problems (default)
- **Easy**: Shows only easy problems (1-10)
- **Medium**: Shows only medium problems (11-20)
- **Hard**: Shows only hard problems (21-25)

**3. Problem Cards**

Each card displays:
- **Problem Number**: Large number badge
- **Difficulty**: Color-coded badge (green/yellow/red)
- **Preview**: First 200 characters of problem
- **Metadata**:
  - 📝 Solution count
  - 🖼️ Image count
  - 🏷️ Topic count

**4. Interactions**
- **Click card**: Navigate to detail page
- **Click filter**: Show/hide problems by difficulty
- **Hover effect**: Card lifts and highlights

### Detail Page Features

**1. Problem Header**
- Problem title (e.g., "Problem 5")
- Difficulty badge
- Back to list button

**2. Problem Information**
- Year, Test, Problem Number, Difficulty
- Displayed in clean info cards

**3. Problem Statement**
- Full problem text
- Answer choices (if multiple choice)
- Image count indicator

**4. Solutions Section**
- Multiple solution approaches
- Expandable/collapsible design
- "Show/Hide" buttons
- Preserved formatting

**5. Additional Sections**
- **Topics**: Math topics/categories
- **Related Problems**: See Also references
- **Images Info**: Count of diagrams/equations

**6. Navigation**
- **Previous**: Go to previous problem (disabled on Problem 1)
- **Next**: Go to next problem (disabled on Problem 25)
- **Back to List**: Return to main page

## Usage Examples

### Example 1: Browse All Problems

1. Open http://localhost:13001/viewer/index.html
2. Scroll through all 25 problem cards
3. Click on "Problem 5" to view details

### Example 2: Filter by Difficulty

1. Open main page
2. Click "Easy" button
3. See only problems 1-10 displayed
4. Click "Medium" to see problems 11-20
5. Click "All Problems" to reset

### Example 3: Study a Specific Problem

1. Navigate to Problem 10 detail page
2. Read problem statement
3. Try to solve it yourself
4. Click "Show" on Solution 1 to reveal answer
5. Click "Show" on other solutions to see alternatives
6. Click "Next" to move to Problem 11

### Example 4: Navigate Problem Set

1. Start at Problem 1 detail page
2. Read and solve problem
3. Click "Next" to move to Problem 2
4. Continue clicking "Next" to work through all 25
5. "Previous" button allows going back to review

## API Usage

### Get All Problems (JSON)

```bash
curl http://localhost:13001/api/problems | jq '.'
```

**Use case**: Load data in external app

### Get Specific Problem

```bash
curl http://localhost:13001/api/problems/5 | jq '.content'
```

**Use case**: Fetch individual problem for integration

### Example: Load in JavaScript

```javascript
// Fetch all problems
fetch('http://localhost:13001/api/problems')
  .then(res => res.json())
  .then(data => {
    console.log(`Total: ${data.metadata.totalProblems} problems`);
    console.log(`First problem: ${data.problems[0].content}`);
  });

// Fetch specific problem
fetch('http://localhost:13001/api/problems/10')
  .then(res => res.json())
  .then(problem => {
    console.log(`Problem ${problem.problemNumber}: ${problem.content}`);
  });
```

## File Structure

```
sbuddy/
├── public/
│   └── viewer/
│       ├── index.html         # Main page (problem list)
│       ├── problem.html       # Detail page
│       └── README.md          # Viewer documentation
│
├── crawled_data/
│   ├── amc_2012_10a_problems.json          # Data (formatted)
│   ├── amc_2012_10a_problems_compact.json  # Data (compact)
│   └── README.md              # Data documentation
│
├── scripts/
│   ├── crawl2012AMC10A.ts     # Crawler script
│   ├── serveViewer.ts         # Express server
│   └── viewCrawledData.ts     # CLI viewer
│
└── package.json               # npm scripts
```

## Commands Reference

| Command | Description | Output |
|---------|-------------|--------|
| `npm run crawl:2012-amc10a` | Crawl 2012 AMC 10A | JSON files in `crawled_data/` |
| `npm run serve:viewer` | Start web server | Server at port 3001 |
| `npm run view:crawled -- <file>` | CLI viewer | Console output |
| `npm run view:crawled -- <file> --problem 5` | View specific problem | Console output |

## Design Details

### Color Scheme

**Primary Colors**:
- Background gradient: Purple (#667eea to #764ba2)
- Cards: White with shadow
- Text: Dark gray (#212529)

**Difficulty Colors**:
- Easy: Green (#28a745)
- Medium: Yellow (#ffc107)
- Hard: Red (#dc3545)

**Accent Colors**:
- Hover: Light purple shadow
- Info badges: Blue (#667eea)

### Typography

- **Font**: System fonts (Apple, Segoe UI, Roboto)
- **Headers**: 2.5rem (40px) on main, 2rem (32px) on detail
- **Body**: 1rem (16px)
- **Small**: 0.85rem (13.6px)

### Layout

- **Max width**: 1200px (main), 1000px (detail)
- **Grid**: Auto-fit columns, min 200px
- **Gap**: 15-20px between elements
- **Padding**: 40px on desktop, 20px on mobile

### Responsive Breakpoints

- **Desktop**: > 768px
- **Mobile**: ≤ 768px

**Mobile changes**:
- Single column layout
- Smaller headers
- Stacked navigation
- Full-width cards

## Advanced Usage

### Integrate with Sbuddy Backend

```typescript
// Import crawled data to database
import fs from 'fs';
import aopsScraper from './src/services/aopsScraper';
import problemRepository from './src/services/problemRepository';

const data = JSON.parse(
  fs.readFileSync('crawled_data/amc_2012_10a_problems.json', 'utf-8')
);

// Convert and import
const sbuddyProblems = data.problems.map(p =>
  aopsScraper.convertToSbuddyProblem(p, tenantId)
);

await problemRepository.bulkImportProblems(sbuddyProblems);
```

### Add More Years

1. **Crawl new data**:
   ```bash
   npm run crawl:2023-amc10a  # (create crawler first)
   ```

2. **Update viewer**:
   ```javascript
   // Add data selector dropdown
   const dataFiles = {
     '2012_A': 'amc_2012_10a_problems.json',
     '2023_A': 'amc_2023_10a_problems.json'
   };
   ```

3. **Dynamic loading**:
   ```javascript
   const selectedYear = document.getElementById('yearSelector').value;
   fetch(`../../crawled_data/${dataFiles[selectedYear]}`)
   ```

### Export Problem Sets

```javascript
// Filter and export
const easyProblems = allProblems.filter(p => p.difficulty === 'easy');
const blob = new Blob([JSON.stringify(easyProblems, null, 2)],
                      { type: 'application/json' });
const url = URL.createObjectURL(blob);
// Trigger download
```

### Print Problem Set

```javascript
// Generate printable HTML
const printWindow = window.open('', '', 'width=800,height=600');
printWindow.document.write(`
  <html>
    <head><title>Problems 1-10</title></head>
    <body>
      ${problems.map(p => `
        <div class="problem">
          <h2>Problem ${p.problemNumber}</h2>
          <p>${p.content}</p>
        </div>
      `).join('')}
    </body>
  </html>
`);
printWindow.print();
```

## Deployment

### Option 1: Static Hosting (Netlify/Vercel)

1. **Deploy files**:
   ```
   public/
   crawled_data/
   ```

2. **Configuration** (netlify.toml):
   ```toml
   [[redirects]]
     from = "/"
     to = "/viewer/index.html"
     status = 301
   ```

### Option 2: Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 13001
CMD ["npm", "run", "serve:viewer"]
```

**Build and run**:
```bash
docker build -t amc-viewer .
docker run -p 13001:13001 amc-viewer
```

### Option 3: Cloud (Heroku, Railway, etc.)

1. **Add Procfile**:
   ```
   web: npm run serve:viewer
   ```

2. **Set environment**:
   ```bash
   heroku config:set PORT=3001
   ```

3. **Deploy**:
   ```bash
   git push heroku main
   ```

## Troubleshooting

### Server Issues

**Problem**: Port already in use
```bash
# Find process using port 13001
lsof -i :13001

# Kill it
kill -9 <PID>
```

**Problem**: Server won't start
```bash
# Check if express is installed
npm list express

# Reinstall dependencies
npm install
```

### Data Loading Issues

**Problem**: 404 on JSON file
```bash
# Check file exists
ls crawled_data/amc_2012_10a_problems.json

# Check file permissions
chmod 644 crawled_data/amc_2012_10a_problems.json
```

**Problem**: CORS errors (if using different port)
```typescript
// Add CORS to server
import cors from 'cors';
app.use(cors());
```

### Display Issues

**Problem**: Blank page
- Open browser console (F12)
- Check for JavaScript errors
- Verify JSON loads in Network tab

**Problem**: Styling broken
- Check if CSS is inline in HTML
- Clear browser cache
- Try different browser

**Problem**: Solutions won't expand
- Check JavaScript console for errors
- Verify solution data exists in JSON
- Test with different problem

## Performance Tips

1. **Lazy load images**: Only load images when solution expanded
2. **Pagination**: Show 10 problems at a time instead of 25
3. **Virtualization**: Use virtual scrolling for large datasets
4. **Caching**: Add service worker for offline support
5. **Minification**: Minify HTML/CSS/JS for production

## Security Considerations

1. **Input validation**: Sanitize problem numbers from URL
2. **XSS protection**: Escape HTML in problem content
3. **Rate limiting**: Add rate limiting to API endpoints
4. **HTTPS**: Use HTTPS in production
5. **Content Security Policy**: Add CSP headers

## Future Enhancements

### Short-term
- [ ] Search/filter by keywords
- [ ] Bookmark favorite problems
- [ ] Dark mode toggle
- [ ] Print stylesheet

### Medium-term
- [ ] LaTeX rendering with MathJax/KaTeX
- [ ] Image lightbox viewer
- [ ] User accounts and progress tracking
- [ ] Mobile app (React Native)

### Long-term
- [ ] Spaced repetition integration
- [ ] Collaborative problem solving
- [ ] Video solution embeds
- [ ] AI-powered problem recommendations

## Support

**Documentation**:
- Viewer README: `public/viewer/README.md`
- Data README: `crawled_data/README.md`
- Crawling Guide: `CRAWLING_GUIDE.md`

**Issues**: Create issue at your GitHub repo

**Questions**: Check console logs, network tab, and error messages

---

**Created**: October 19, 2025
**Version**: 1.0.0
**Status**: Production Ready ✅

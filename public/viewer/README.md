# AMC Problems Viewer

Interactive web-based viewer for browsing crawled AMC competition problems.

## Features

✅ **Browse All Problems** - View all 25 problems from 2012 AMC 10A
✅ **Filter by Difficulty** - Easy, Medium, Hard filtering
✅ **Detailed View** - Click any problem to see full details
✅ **Multiple Solutions** - Expand/collapse solution approaches
✅ **Navigation** - Previous/Next buttons to browse problems
✅ **Metadata Display** - Year, test, difficulty, topics, images
✅ **Responsive Design** - Works on desktop and mobile

## Quick Start

### 1. Start the Server

```bash
npm run serve:viewer
```

### 2. Open in Browser

Main page: http://localhost:13001/viewer/index.html

### 3. Browse Problems

- Click on any problem card to view details
- Use filters to show Easy, Medium, or Hard problems only
- Navigate between problems using Previous/Next buttons

## Pages

### Main Page (`index.html`)

**Features**:
- Dataset metadata (year, test, total problems, avg solutions)
- Difficulty distribution statistics
- Filterable problem list
- Problem preview cards with:
  - Problem number
  - Difficulty badge
  - Content preview (first 200 chars)
  - Solution count
  - Image count
  - Topic count

**Interactions**:
- Click any problem card to view details
- Click filter buttons to show/hide by difficulty

### Detail Page (`problem.html`)

**Features**:
- Full problem statement
- Answer choices (if multiple choice)
- Multiple expandable solutions
- Topics/tags
- Related problems
- Image count indicator
- Problem metadata (year, test, difficulty)

**Interactions**:
- Click "Show/Hide" on solutions to expand/collapse
- Use "Previous/Next" buttons to navigate
- Click "Back to List" to return to main page

## API Endpoints

The server also provides REST API endpoints:

### Get All Problems

```bash
GET http://localhost:13001/api/problems
```

**Response**:
```json
{
  "metadata": {
    "crawledAt": "2025-10-19T23:16:47.195Z",
    "source": "https://...",
    "year": 2012,
    "test": "AMC 10A",
    "totalProblems": 25
  },
  "problems": [...]
}
```

### Get Specific Problem

```bash
GET http://localhost:13001/api/problems/5
```

**Response**:
```json
{
  "year": 2012,
  "test": "A",
  "problemNumber": 5,
  "content": "...",
  "solutions": [...],
  "difficulty": "easy"
}
```

## File Structure

```
public/viewer/
├── index.html          # Main page (problem list)
├── problem.html        # Detail page (individual problem)
└── README.md          # This file

scripts/
└── serveViewer.ts     # Express server

crawled_data/
└── amc_2012_10a_problems.json  # Data source
```

## Technology Stack

- **Frontend**: Pure HTML, CSS, JavaScript (no frameworks)
- **Backend**: Express.js (TypeScript)
- **Data Format**: JSON
- **Styling**: Custom CSS with gradients and animations

## Design Features

### Color Scheme

- Primary: Purple gradient (#667eea to #764ba2)
- Easy: Green (#28a745)
- Medium: Yellow/Orange (#ffc107)
- Hard: Red (#dc3545)

### Responsive Design

- Mobile-first approach
- Flexbox and CSS Grid layouts
- Breakpoints at 768px for mobile/desktop

### Interactive Elements

- Hover effects on cards
- Smooth transitions
- Expandable/collapsible sections
- Button state management

## Customization

### Change Port

Edit `package.json`:
```json
"serve:viewer": "PORT=8080 ts-node scripts/serveViewer.ts"
```

### Style Modifications

Edit the `<style>` section in `index.html` or `problem.html`:

```css
/* Change primary color */
background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);

/* Change difficulty colors */
.difficulty-badge.easy { background: #YOUR_GREEN; }
```

### Add More Data

To view different years/tests:

1. Crawl the data:
   ```bash
   npm run crawl:2023-amc10b  # (create custom crawler)
   ```

2. Update viewer to point to new file:
   ```javascript
   // In index.html and problem.html
   fetch('../../crawled_data/amc_2023_10b_problems.json')
   ```

## Browser Compatibility

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+

## Performance

- Fast initial load (~335KB JSON)
- Client-side filtering (instant)
- No external dependencies
- Optimized for 25 problems

## Screenshots

### Main Page
- Shows all 25 problems in cards
- Metadata display at top
- Filter buttons for difficulty

### Detail Page
- Full problem statement
- Expandable solutions
- Navigation controls
- Difficulty badge

## Troubleshooting

### Server won't start

**Check if port 13001 is in use**:
```bash
lsof -i :13001
```

**Kill existing process**:
```bash
kill -9 <PID>
```

### Can't load data

**Verify data file exists**:
```bash
ls crawled_data/amc_2012_10a_problems.json
```

**Check file permissions**:
```bash
chmod 644 crawled_data/amc_2012_10a_problems.json
```

### Blank page

**Check browser console** (F12) for errors
**Verify server is running** at http://localhost:13001
**Check network tab** to see if JSON loads

## Future Enhancements

- [ ] Search functionality
- [ ] Bookmark favorite problems
- [ ] Print problem sets
- [ ] Export to PDF
- [ ] LaTeX rendering for equations
- [ ] Image lightbox viewer
- [ ] Multi-year data selector
- [ ] Dark mode toggle
- [ ] User progress tracking

## Development

### Run in development mode

```bash
npm run serve:viewer
```

### Build for production

The viewer is static HTML/CSS/JS, so no build step needed. Just:

1. Copy `public/` and `crawled_data/` to your web server
2. Serve with any static file server

### Deploy to production

**Option 1: Static hosting (Netlify, Vercel)**
- Upload `public/` directory
- Upload `crawled_data/` directory

**Option 2: Node.js server**
- Keep Express server
- Set `PORT` environment variable
- Run `npm run serve:viewer`

## Credits

- Data source: Art of Problem Solving (https://artofproblemsolving.com)
- Built for: Sbuddy - AI-Powered Problem Recognition & Study System
- Crawler: Custom AoPS scraper with Cheerio

## License

Problems are copyrighted © by the Mathematical Association of America (MAA).
This viewer is for educational purposes only.

---

**Last Updated**: October 19, 2025
**Version**: 1.0

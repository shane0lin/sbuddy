import express from 'express';
import path from 'path';

/**
 * Simple HTTP server to serve the problem viewer
 */
class ViewerServer {
  private app: express.Application;
  private port: number;

  constructor(port: number = 13001) {
    this.app = express();
    this.port = port;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, '../public')));

    // Serve crawled data
    this.app.use('/crawled_data', express.static(path.join(__dirname, '../crawled_data')));

    // Redirect root to viewer
    this.app.get('/', (req, res) => {
      res.redirect('/viewer/index.html');
    });

    // API endpoint to get problem data
    this.app.get('/api/problems', (req, res) => {
      const dataPath = path.join(__dirname, '../crawled_data/amc_2012_10a_problems.json');
      res.sendFile(dataPath);
    });

    // API endpoint to get specific problem
    this.app.get('/api/problems/:number', (req, res) => {
      const fs = require('fs');
      const dataPath = path.join(__dirname, '../crawled_data/amc_2012_10a_problems.json');
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      const problemNumber = parseInt(req.params.number);
      const problem = data.problems.find((p: any) => p.problemNumber === problemNumber);

      if (problem) {
        res.json(problem);
      } else {
        res.status(404).json({ error: 'Problem not found' });
      }
    });
  }

  start(): void {
    this.app.listen(this.port, () => {
      console.log('\n' + '='.repeat(70));
      console.log('🚀 AMC Problem Viewer Server Started!');
      console.log('='.repeat(70));
      console.log(`\n📊 Server running at: http://localhost:${this.port}`);
      console.log(`\n🔗 Quick Links:`);
      console.log(`   Main Page:     http://localhost:${this.port}/viewer/index.html`);
      console.log(`   Problem 1:     http://localhost:${this.port}/viewer/problem.html?number=1`);
      console.log(`   API Endpoint:  http://localhost:${this.port}/api/problems`);
      console.log(`\n💡 Features:`);
      console.log(`   ✅ Browse all 25 problems from 2012 AMC 10A`);
      console.log(`   ✅ Filter by difficulty (Easy, Medium, Hard)`);
      console.log(`   ✅ View detailed problem statements and solutions`);
      console.log(`   ✅ Navigate between problems with Previous/Next buttons`);
      console.log(`\n⌨️  Press Ctrl+C to stop the server`);
      console.log('='.repeat(70) + '\n');
    });
  }
}

// CLI
if (require.main === module) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 13001;
  const server = new ViewerServer(port);
  server.start();
}

export default ViewerServer;

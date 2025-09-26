import axios from 'axios';
import cheerio from 'cheerio';
import { AoPSScraper } from '../../src/services/aopsScraper';
import { AMCProblem } from '../../src/types';

// Mock axios and cheerio
jest.mock('axios');
jest.mock('../../src/models/database', () => ({
  db: {
    query: jest.fn()
  }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AoPSScraper', () => {
  let scraper: AoPSScraper;

  beforeEach(() => {
    scraper = new AoPSScraper();
    jest.clearAllMocks();
  });

  describe('getAvailableTests', () => {
    it('should extract available AMC 10 tests from the main page', async () => {
      const mockHTML = `
        <html>
          <body>
            <div id="mw-content-text">
              <p><a href="/wiki/index.php/2024_AMC_10A_Problems_and_Solutions">2024 AMC 10A</a></p>
              <p><a href="/wiki/index.php/2024_AMC_10B_Problems_and_Solutions">2024 AMC 10B</a></p>
              <p><a href="/wiki/index.php/2023_AMC_10A_Problems_and_Solutions">2023 AMC 10A</a></p>
              <p><a href="/wiki/index.php/2022_AMC_10B_Problems_and_Solutions">2022 AMC 10B</a></p>
            </div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHTML });

      const tests = await scraper.getAvailableTests();

      expect(tests).toHaveLength(4);
      expect(tests).toContainEqual({ year: 2024, test: 'A' });
      expect(tests).toContainEqual({ year: 2024, test: 'B' });
      expect(tests).toContainEqual({ year: 2023, test: 'A' });
      expect(tests).toContainEqual({ year: 2022, test: 'B' });
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const tests = await scraper.getAvailableTests();

      expect(tests).toEqual([]);
    });

    it('should handle malformed HTML gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ data: '<html><body>No valid links</body></html>' });

      const tests = await scraper.getAvailableTests();

      expect(tests).toEqual([]);
    });
  });

  describe('scrapeTest', () => {
    it('should scrape problems from a test page', async () => {
      const mockHTML = `
        <html>
          <body>
            <div id="mw-content-text">
              <h2><span class="mw-headline">Problem 1</span></h2>
              <p>What is the value of $2 + 2$?</p>
              <p>(A) 3 (B) 4 (C) 5 (D) 6 (E) 7</p>

              <h3><span class="mw-headline">Solution</span></h3>
              <p>The answer is $2 + 2 = 4$.</p>
              <p>The answer is (B).</p>

              <h2><span class="mw-headline">Problem 2</span></h2>
              <p>What is the value of $3 + 3$?</p>
              <p>(A) 5 (B) 6 (C) 7 (D) 8 (E) 9</p>

              <h3><span class="mw-headline">Solution</span></h3>
              <p>The answer is $3 + 3 = 6$.</p>
              <p>The answer is (B).</p>
            </div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHTML });

      const problems = await scraper.scrapeTest(2024, 'A');

      expect(problems).toHaveLength(2);

      expect(problems[0]).toMatchObject({
        title: 'AMC 10A 2024 Problem 1',
        content: expect.stringContaining('What is the value of $2 + 2$?'),
        source: 'AMC 10A 2024',
        category: 'Competition Math',
        difficulty: 'medium',
        subject: 'Mathematics',
        exam_type: 'AMC 10A',
        exam_year: 2024,
        problem_number: 1,
        answer_choices: expect.arrayContaining(['3', '4', '5', '6', '7'])
      });

      expect(problems[1]).toMatchObject({
        problem_number: 2,
        content: expect.stringContaining('What is the value of $3 + 3$?')
      });
    });

    it('should handle test pages without problems', async () => {
      const mockHTML = '<html><body><div id="mw-content-text">No problems found</div></body></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHTML });

      const problems = await scraper.scrapeTest(2024, 'A');

      expect(problems).toEqual([]);
    });

    it('should handle network errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Failed to fetch'));

      const problems = await scraper.scrapeTest(2024, 'A');

      expect(problems).toEqual([]);
    });
  });

  describe('parseProblemContent', () => {
    it('should parse problem content correctly', () => {
      const mockHTML = `
        <div>
          <h2><span class="mw-headline">Problem 5</span></h2>
          <p>What is the area of a circle with radius 3?</p>
          <p>(A) $3\\pi$ (B) $6\\pi$ (C) $9\\pi$ (D) $12\\pi$ (E) $18\\pi$</p>
        </div>
      `;

      const $ = cheerio.load(mockHTML);
      const problemDiv = $('div');

      const result = (scraper as any).parseProblemContent($, problemDiv, 2024, 'A');

      expect(result.problem_number).toBe(5);
      expect(result.content).toContain('What is the area of a circle with radius 3?');
      expect(result.answer_choices).toEqual(['$3\\pi$', '$6\\pi$', '$9\\pi$', '$12\\pi$', '$18\\pi$']);
      expect(result.exam_year).toBe(2024);
      expect(result.exam_type).toBe('AMC 10A');
    });

    it('should handle problems without answer choices', () => {
      const mockHTML = `
        <div>
          <h2><span class="mw-headline">Problem 10</span></h2>
          <p>Find the value of x where $x^2 = 16$.</p>
        </div>
      `;

      const $ = cheerio.load(mockHTML);
      const problemDiv = $('div');

      const result = (scraper as any).parseProblemContent($, problemDiv, 2024, 'B');

      expect(result.problem_number).toBe(10);
      expect(result.answer_choices).toEqual([]);
    });

    it('should handle malformed problem numbers', () => {
      const mockHTML = `
        <div>
          <h2><span class="mw-headline">Problem ABC</span></h2>
          <p>Invalid problem number.</p>
        </div>
      `;

      const $ = cheerio.load(mockHTML);
      const problemDiv = $('div');

      const result = (scraper as any).parseProblemContent($, problemDiv, 2024, 'A');

      expect(result).toBeNull();
    });
  });

  describe('extractAnswerChoices', () => {
    it('should extract standard multiple choice answers', () => {
      const text = '(A) 10 (B) 20 (C) 30 (D) 40 (E) 50';
      const choices = (scraper as any).extractAnswerChoices(text);

      expect(choices).toEqual(['10', '20', '30', '40', '50']);
    });

    it('should extract answers with mathematical expressions', () => {
      const text = '(A) $2\\pi$ (B) $4\\pi$ (C) $6\\pi$ (D) $8\\pi$ (E) $10\\pi$';
      const choices = (scraper as any).extractAnswerChoices(text);

      expect(choices).toEqual(['$2\\pi$', '$4\\pi$', '$6\\pi$', '$8\\pi$', '$10\\pi$']);
    });

    it('should handle text with no answer choices', () => {
      const text = 'This is just regular text without answer choices.';
      const choices = (scraper as any).extractAnswerChoices(text);

      expect(choices).toEqual([]);
    });

    it('should handle partial answer choices', () => {
      const text = '(A) 15 (B) 25 (C) 35';
      const choices = (scraper as any).extractAnswerChoices(text);

      expect(choices).toEqual(['15', '25', '35']);
    });
  });

  describe('parseSolutions', () => {
    it('should parse multiple solutions correctly', () => {
      const mockHTML = `
        <div>
          <h3><span class="mw-headline">Solution</span></h3>
          <p>This is the first solution approach.</p>
          <p>We calculate step by step.</p>
          <p>The answer is (C).</p>

          <h3><span class="mw-headline">Solution 2</span></h3>
          <p>Here's an alternative approach.</p>
          <p>Using a different method.</p>
          <p>The answer is still (C).</p>
        </div>
      `;

      const $ = cheerio.load(mockHTML);
      const solutions = (scraper as any).parseSolutions($, $('div'));

      expect(solutions).toHaveLength(2);
      expect(solutions[0]).toContain('This is the first solution approach');
      expect(solutions[1]).toContain('Here\'s an alternative approach');
    });

    it('should handle single solution', () => {
      const mockHTML = `
        <div>
          <h3><span class="mw-headline">Solution</span></h3>
          <p>Single solution content.</p>
          <p>The answer is (B).</p>
        </div>
      `;

      const $ = cheerio.load(mockHTML);
      const solutions = (scraper as any).parseSolutions($, $('div'));

      expect(solutions).toHaveLength(1);
      expect(solutions[0]).toContain('Single solution content');
    });

    it('should return empty array when no solutions found', () => {
      const mockHTML = '<div><p>Problem content without solutions.</p></div>';
      const $ = cheerio.load(mockHTML);
      const solutions = (scraper as any).parseSolutions($, $('div'));

      expect(solutions).toEqual([]);
    });
  });

  describe('cleanText', () => {
    it('should clean LaTeX and extra whitespace', () => {
      const dirtyText = '  What is  $\\frac{1}{2}$  equal to?  ';
      const cleanedText = (scraper as any).cleanText(dirtyText);

      expect(cleanedText).toBe('What is $\\frac{1}{2}$ equal to?');
    });

    it('should handle empty or whitespace-only text', () => {
      expect((scraper as any).cleanText('')).toBe('');
      expect((scraper as any).cleanText('   ')).toBe('');
    });

    it('should preserve mathematical notation', () => {
      const mathText = 'Find $x$ where $x^2 + 2x - 3 = 0$.';
      const cleanedText = (scraper as any).cleanText(mathText);

      expect(cleanedText).toBe('Find $x$ where $x^2 + 2x - 3 = 0$.');
    });
  });

  describe('delay handling', () => {
    it('should respect rate limiting delays', async () => {
      const startTime = Date.now();
      await (scraper as any).sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(95); // Account for timing precision
    });
  });

  describe('scrapeAllAMC10Problems', () => {
    it('should scrape all available tests', async () => {
      // Mock getAvailableTests
      const mockTests = [
        { year: 2024, test: 'A' },
        { year: 2024, test: 'B' }
      ];

      const getAvailableTestsSpy = jest.spyOn(scraper, 'getAvailableTests')
        .mockResolvedValue(mockTests);

      // Mock scrapeTest
      const mockProblem: AMCProblem = {
        title: 'Test Problem',
        content: 'Test content',
        source: 'AMC 10A 2024',
        category: 'Competition Math',
        difficulty: 'medium',
        subject: 'Mathematics',
        exam_type: 'AMC 10A',
        exam_year: 2024,
        problem_number: 1,
        tags: ['amc10'],
        answer_choices: ['A', 'B', 'C', 'D', 'E'],
        solutions: ['Test solution'],
        tenant_id: 'default'
      };

      const scrapeTestSpy = jest.spyOn(scraper, 'scrapeTest')
        .mockResolvedValue([mockProblem]);

      // Mock sleep to speed up tests
      const sleepSpy = jest.spyOn(scraper as any, 'sleep')
        .mockResolvedValue(undefined);

      const results = await scraper.scrapeAllAMC10Problems();

      expect(results).toHaveLength(2); // 2 problems (one from each test)
      expect(getAvailableTestsSpy).toHaveBeenCalledTimes(1);
      expect(scrapeTestSpy).toHaveBeenCalledTimes(2);
      expect(scrapeTestSpy).toHaveBeenCalledWith(2024, 'A');
      expect(scrapeTestSpy).toHaveBeenCalledWith(2024, 'B');
      expect(sleepSpy).toHaveBeenCalledTimes(2);

      // Restore spies
      getAvailableTestsSpy.mockRestore();
      scrapeTestSpy.mockRestore();
      sleepSpy.mockRestore();
    });

    it('should handle scraping errors gracefully', async () => {
      jest.spyOn(scraper, 'getAvailableTests')
        .mockResolvedValue([{ year: 2024, test: 'A' }]);

      jest.spyOn(scraper, 'scrapeTest')
        .mockRejectedValue(new Error('Scraping failed'));

      const results = await scraper.scrapeAllAMC10Problems();

      expect(results).toEqual([]);
    });
  });

  describe('URL construction', () => {
    it('should construct correct URLs for different test years and types', () => {
      const baseUrl = 'https://artofproblemsolving.com/wiki/index.php';

      expect((scraper as any).getTestUrl(2024, 'A')).toBe(`${baseUrl}/2024_AMC_10A_Problems_and_Solutions`);
      expect((scraper as any).getTestUrl(2023, 'B')).toBe(`${baseUrl}/2023_AMC_10B_Problems_and_Solutions`);
      expect((scraper as any).getTestUrl(2022, 'A')).toBe(`${baseUrl}/2022_AMC_10A_Problems_and_Solutions`);
    });
  });
});
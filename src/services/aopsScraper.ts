import axios from 'axios';
import * as cheerio from 'cheerio';
import { Problem } from '../types';

export interface AMCProblem {
  year: number;
  test: 'A' | 'B';
  problemNumber: number;
  content: string;
  solutions: string[];
  choices?: string[];
  answer?: string;
}

export class AoPSScraper {
  private readonly baseUrl = 'https://artofproblemsolving.com/wiki/index.php';
  private readonly delay = 1000; // 1 second delay between requests to be respectful

  async scrapeAllAMC10Problems(): Promise<AMCProblem[]> {
    const problems: AMCProblem[] = [];

    console.log('Starting AMC 10 scraping...');

    // Get years and tests from main index page
    const testsToScrape = await this.getAvailableTests();

    for (const test of testsToScrape) {
      console.log(`Scraping ${test.year} AMC 10${test.test}...`);

      try {
        const testProblems = await this.scrapeTest(test.year, test.test);
        problems.push(...testProblems);

        // Be respectful to the server
        await this.sleep(this.delay);
      } catch (error) {
        console.error(`Error scraping ${test.year} AMC 10${test.test}:`, error);
      }
    }

    console.log(`Completed scraping. Found ${problems.length} problems total.`);
    return problems;
  }

  private async getAvailableTests(): Promise<Array<{year: number, test: 'A' | 'B'}>> {
    try {
      const response = await axios.get(`${this.baseUrl}/AMC_10_Problems_and_Solutions`);
      const $ = cheerio.load(response.data);

      const tests: Array<{year: number, test: 'A' | 'B'}> = [];

      // Find all AMC 10 test links
      $('a[href*="AMC_10"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('AMC_10')) {
          const match = href.match(/(\d{4})_AMC_10([AB])/);
          if (match) {
            const year = parseInt(match[1]);
            const test = match[2] as 'A' | 'B';

            // Only scrape years from 2020 onwards to limit scope
            if (year >= 2020) {
              tests.push({ year, test });
            }
          }
        }
      });

      // Remove duplicates
      const uniqueTests = tests.filter((test, index, self) =>
        index === self.findIndex(t => t.year === test.year && t.test === test.test)
      );

      console.log(`Found ${uniqueTests.length} tests to scrape:`, uniqueTests);
      return uniqueTests;
    } catch (error) {
      console.error('Error getting available tests:', error);
      return [];
    }
  }

  private async scrapeTest(year: number, test: 'A' | 'B'): Promise<AMCProblem[]> {
    const problems: AMCProblem[] = [];

    // AMC 10 typically has 25 problems
    for (let problemNum = 1; problemNum <= 25; problemNum++) {
      try {
        const problem = await this.scrapeProblem(year, test, problemNum);
        if (problem) {
          problems.push(problem);
        }

        // Small delay between problems
        await this.sleep(200);
      } catch (error) {
        console.error(`Error scraping ${year} AMC 10${test} Problem ${problemNum}:`, error);
      }
    }

    return problems;
  }

  private async scrapeProblem(year: number, test: 'A' | 'B', problemNum: number): Promise<AMCProblem | null> {
    const url = `${this.baseUrl}/${year}_AMC_10${test}_Problems/Problem_${problemNum}`;

    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Extract problem content
      const problemContent = this.extractProblemContent($);
      if (!problemContent) {
        console.log(`No problem content found for ${year} AMC 10${test} Problem ${problemNum}`);
        return null;
      }

      // Extract solutions
      const solutions = this.extractSolutions($);

      // Extract answer choices if present
      const choices = this.extractAnswerChoices($);

      return {
        year,
        test,
        problemNumber: problemNum,
        content: problemContent,
        solutions,
        choices
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log(`Problem ${problemNum} not found for ${year} AMC 10${test}`);
      } else {
        console.error(`Error fetching ${url}:`, error);
      }
      return null;
    }
  }

  private extractProblemContent($: cheerio.Root): string | null {
    // Look for the Problem section
    const problemSection = $('span#Problem').parent().next();

    if (problemSection.length === 0) {
      // Try alternative selectors
      const altSection = $('.mw-headline:contains("Problem")').parent().next();
      if (altSection.length === 0) {
        return null;
      }
      return this.cleanText(altSection.text());
    }

    return this.cleanText(problemSection.text());
  }

  private extractSolutions($: cheerio.Root): string[] {
    const solutions: string[] = [];

    // Find all solution sections
    $('.mw-headline').each((_, element) => {
      const headline = $(element).text();
      if (headline.toLowerCase().includes('solution')) {
        const solutionContent = $(element).parent().nextUntil('.mw-headline').text();
        if (solutionContent.trim()) {
          solutions.push(this.cleanText(solutionContent));
        }
      }
    });

    return solutions;
  }

  private extractAnswerChoices($: cheerio.Root): string[] {
    const choices: string[] = [];
    const text = $('body').text();

    // Look for multiple choice pattern (A) ... (B) ... (C) ... (D) ... (E)
    const choicePattern = /\([ABCDE]\)[^(]+/g;
    const matches = text.match(choicePattern);

    if (matches) {
      choices.push(...matches.map((match: string) => this.cleanText(match)));
    }

    return choices;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\[.*?\]/g, '') // Remove wiki markup
      .replace(/\$\$([^$]+)\$\$/g, '$1') // Clean LaTeX delimiters
      .replace(/\$([^$]+)\$/g, '$1') // Clean inline LaTeX
      .trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  convertToSbuddyProblem(amcProblem: AMCProblem, tenantId: string): Omit<Problem, 'id' | 'created_at' | 'updated_at'> {
    return {
      title: `${amcProblem.year} AMC 10${amcProblem.test} Problem ${amcProblem.problemNumber}`,
      content: this.formatProblemContent(amcProblem),
      source: 'Art of Problem Solving',
      category: 'Competition',
      difficulty: 'medium', // AMC 10 is generally medium difficulty
      subject: 'Mathematics',
      exam_type: 'AMC10',
      exam_year: amcProblem.year,
      problem_number: amcProblem.problemNumber,
      tags: [`AMC10${amcProblem.test}`, `${amcProblem.year}`, 'competition', 'mathematics'],
      solution: amcProblem.solutions.length > 0 ? amcProblem.solutions[0] : undefined,
      tenant_id: tenantId
    };
  }

  private formatProblemContent(amcProblem: AMCProblem): string {
    let content = amcProblem.content;

    if (amcProblem.choices && amcProblem.choices.length > 0) {
      content += '\n\nAnswer choices:\n';
      content += amcProblem.choices.join('\n');
    }

    return content;
  }

  // Method to scrape a specific test for testing
  async scrapeSpecificTest(year: number, test: 'A' | 'B', problemCount: number = 5): Promise<AMCProblem[]> {
    console.log(`Scraping ${year} AMC 10${test} (first ${problemCount} problems)...`);

    const problems: AMCProblem[] = [];

    for (let problemNum = 1; problemNum <= problemCount; problemNum++) {
      try {
        const problem = await this.scrapeProblem(year, test, problemNum);
        if (problem) {
          problems.push(problem);
          console.log(`✓ Problem ${problemNum}: ${problem.content.substring(0, 100)}...`);
        }

        await this.sleep(500);
      } catch (error) {
        console.error(`Error scraping Problem ${problemNum}:`, error);
      }
    }

    return problems;
  }
}

export default new AoPSScraper();
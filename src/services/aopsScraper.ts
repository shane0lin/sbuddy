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
  topics?: string[];                           // Math topics extracted from page
  difficulty?: 'easy' | 'medium' | 'hard';     // Inferred from problem number
  seeAlso?: string[];                          // Related problems
  images?: string[];                            // Image URLs found in problem
  answerChoicesImage?: string;                  // Answer choices rendered as LaTeX image
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

      // Extract answer choices FIRST (before processing content)
      const choices = this.extractAnswerChoices($);

      // Extract problem content
      const problemContent = this.extractProblemContent($);
      if (!problemContent) {
        console.log(`No problem content found for ${year} AMC 10${test} Problem ${problemNum}`);
        return null;
      }

      // Extract solutions
      const solutions = this.extractSolutions($);

      // Extract additional metadata
      const topics = this.extractTopics($);
      const seeAlso = this.extractSeeAlso($);
      const difficulty = this.inferDifficulty(problemNum);
      const { images, answerChoicesImage } = this.extractImages($);

      return {
        year,
        test,
        problemNumber: problemNum,
        content: problemContent,
        solutions,
        choices,
        topics,
        difficulty,
        seeAlso,
        images,
        answerChoicesImage
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
    // Look for the Problem section heading
    const problemHeading = $('span#Problem').parent();

    let contentElements;
    if (problemHeading.length === 0) {
      // Try alternative selector
      const altHeading = $('.mw-headline:contains("Problem")').parent();
      if (altHeading.length === 0) {
        return null;
      }
      contentElements = altHeading.nextUntil('h2');
    } else {
      // Get all siblings until the next h2 (Solution section)
      contentElements = problemHeading.nextUntil('h2');
    }

    if (contentElements.length === 0) {
      return null;
    }

    // Extract text with LaTeX from all content elements
    let fullContent = '';
    contentElements.each((_, element) => {
      const text = this.extractTextWithLatex($(element));
      if (text.trim()) {
        fullContent += text + ' ';
      }
    });

    return fullContent.trim() || null;
  }

  private extractTextWithLatex($element: cheerio.Cheerio): string {
    // Get the HTML and replace LaTeX images with their alt text
    let html = $element.html() || '';

    // Replace Asymptote diagram images with a placeholder showing the image URL
    html = html.replace(/<img[^>]+alt="(\[asy\][^"]*\[\/asy\])"[^>]+src="([^"]+)"[^>]*>/gi, (match, alt, src) => {
      const imageUrl = src.startsWith('//') ? `https:${src}` : src;
      return ` [DIAGRAM: ${imageUrl}] `;
    });

    // Also handle reversed order (src before alt)
    html = html.replace(/<img[^>]+src="([^"]+)"[^>]+alt="(\[asy\][^"]*\[\/asy\])"[^>]*>/gi, (match, src, alt) => {
      const imageUrl = src.startsWith('//') ? `https:${src}` : src;
      return ` [DIAGRAM: ${imageUrl}] `;
    });

    // Replace LaTeX equation images with their alt text (which contains LaTeX)
    // Handle both inline math ($...$) and display math (\[...\])
    html = html.replace(/<img[^>]+alt="([^"]+)"[^>]*>/gi, (_match, alt) => ` ${alt} `);

    // Convert back to cheerio element and get text
    const $ = cheerio.load(html);

    // Preserve MathJax script tags containing LaTeX
    $('script[type^="math/tex"]').each((_, elem: cheerio.Element) => {
      const tex = $(elem).html() || '';
      const typeAttr = $(elem).attr('type') || '';
      const type = typeAttr.toLowerCase();
      const isDisplay = type.includes('display');
      const startDelimiter = isDisplay ? '\\[' : '$';
      const endDelimiter = isDisplay ? '\\]' : '$';
      $(elem).replaceWith(` ${startDelimiter}${tex.trim()}${endDelimiter} `);
    });

    return this.cleanText($.root().text());
  }

  private extractSolutions($: cheerio.Root): string[] {
    const solutions: string[] = [];

    // Find all solution sections
    $('h2').each((_, element) => {
      const headline = $(element).text();
      if (headline.toLowerCase().includes('solution')) {
        // Get all content between this h2 and the next h2
        const contentElements = $(element).nextUntil('h2');

        if (contentElements.length > 0) {
          // Extract text with LaTeX preserved
          let solutionText = '';
          contentElements.each((_, contentEl) => {
            const text = this.extractTextWithLatex($(contentEl));
            if (text.trim()) {
              solutionText += text + ' ';
            }
          });

          if (solutionText.trim()) {
            solutions.push(this.cleanText(solutionText));
          }
        }
      }
    });

    return solutions;
  }

  private extractAnswerChoices($: cheerio.Root): string[] {
    const choices: string[] = [];

    // Get the problem section HTML
    const problemSection = $('span#Problem').parent().next();
    let html = problemSection.html() || '';

    // Also check if problem section is empty, try alternative
    if (!html) {
      const altSection = $('.mw-headline:contains("Problem")').parent().next();
      html = altSection.html() || '';
    }

    // Extract from LaTeX image alt text - look for images with answer choices
    const altMatches = html.match(/alt="([^"]*\\textbf\{[^"]+)"/g);

    if (altMatches) {
      altMatches.forEach(altMatch => {
        const altText = altMatch.replace(/alt="/, '').replace(/"$/, '');

        // Parse LaTeX choices: \textbf{(A)}\ text\qquad\textbf{(B)}\ ...
        const parts = altText.split(/\\textbf\{/);

        parts.forEach(part => {
          if (part.match(/^\([A-E]\)/)) {
            const choiceMatch = part.match(/\(([A-E])\)\}\\?\s*(.+?)(?=\\textbf|$)/);
            if (choiceMatch) {
              const letter = choiceMatch[1];
              let text = choiceMatch[2]
                .replace(/\\qquad/g, '')
                .replace(/\\quad/g, '')
                .replace(/\\\s+/g, ' ')
                .replace(/\\text\{([^}]+)\}/g, '$1')
                .replace(/\{/g, '')
                .replace(/\}/g, '')
                .replace(/\\/g, '')
                .trim();

              if (text) {
                choices.push(`(${letter}) ${text}`);
              }
            }
          }
        });
      });
    }

    // Fallback: search in processed text with LaTeX
    if (choices.length === 0) {
      const text = this.extractTextWithLatex(problemSection);

      // Look for answer choice pattern: (A) ... (B) ... (C) ... (D) ... (E)
      const pattern = /\(([A-E])\)\s*([^\(]+?)(?=\s*\([A-E]\)|$)/g;
      let match;
      const found: string[] = [];

      while ((match = pattern.exec(text)) !== null) {
        const letter = match[1];
        const content = match[2].trim();
        if (content.length > 0 && content.length < 200) {
          found.push(`(${letter}) ${content}`);
        }
      }

      if (found.length === 5) {
        return found;
      }
    }

    return choices.slice(0, 5); // AMC problems have exactly 5 choices
  }

  private extractTopics($: cheerio.Root): string[] {
    const topics: string[] = [];

    // Look for category links or tags
    $('.catlinks a, .mw-normal-catlinks a').each((_, element) => {
      const topic = $(element).text().trim();
      if (topic && !topic.includes('AMC') && !topic.includes('Problems')) {
        topics.push(topic);
      }
    });

    return [...new Set(topics)]; // Remove duplicates
  }

  private extractSeeAlso($: cheerio.Root): string[] {
    const seeAlso: string[] = [];

    // Find "See Also" section
    $('.mw-headline').each((_, element) => {
      const headline = $(element).text().toLowerCase();
      if (headline.includes('see also')) {
        const links = $(element).parent().nextUntil('.mw-headline').find('a');
        links.each((_, link) => {
          const text = $(link).text().trim();
          if (text) {
            seeAlso.push(text);
          }
        });
      }
    });

    return seeAlso;
  }

  private inferDifficulty(problemNumber: number): 'easy' | 'medium' | 'hard' {
    // AMC 10: Problems 1-10 are easy, 11-20 are medium, 21-25 are hard
    if (problemNumber <= 10) return 'easy';
    if (problemNumber <= 20) return 'medium';
    return 'hard';
  }

  private extractImages($: cheerio.Root): { images: string[], answerChoicesImage?: string } {
    const images: string[] = [];
    let answerChoicesImage: string | undefined;

    // Find images ONLY in the problem section (not solutions)
    // Use nextUntil to get all content between Problem heading and next heading (Solution)
    const problemHeading = $('span#Problem').parent();

    const processElements = (elements: cheerio.Cheerio) => {
      elements.each((_, element) => {
        $(element).find('img').each((_, img) => {
          const src = $(img).attr('src');
          const alt = $(img).attr('alt') || '';

          if (src) {
            let imageUrl: string;
            if (src.startsWith('http')) {
              imageUrl = src;
            } else if (src.startsWith('//')) {
              imageUrl = `https:${src}`;
            } else {
              imageUrl = `https://artofproblemsolving.com${src}`;
            }

            // Only include LaTeX images
            if (imageUrl.includes('latex.artofproblemsolving.com')) {
              // Check if this is the answer choices image
              if (alt.includes('\\textbf{(A)}') || alt.includes('textbf{(A)}')) {
                answerChoicesImage = imageUrl;
              } else {
                // Regular inline equations - don't store them
                // (MathJax will render them from the content text)
              }
            }
          }
        });
      });
    };

    if (problemHeading.length === 0) {
      const altHeading = $('.mw-headline:contains("Problem")').parent();
      if (altHeading.length > 0) {
        processElements(altHeading.nextUntil('h2'));
      }
    } else {
      processElements(problemHeading.nextUntil('h2'));
    }

    return { images, answerChoicesImage };
  }


  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\[edit\]/gi, '') // Remove wiki edit markers
      .replace(/\[mathjax\]/gi, '') // Remove mathjax markers
      .replace(/\[mathjax display=true\]/gi, '') // Remove mathjax display markers
      .trim();
  }

  // Preserve LaTeX for mathematical rendering
  private preserveLaTeX($: cheerio.Root, selector: string): string {
    const element = $(selector);
    if (element.length === 0) return '';

    // Keep LaTeX delimiters intact for proper rendering
    let text = element.html() || '';

    // Convert HTML to text while preserving LaTeX
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    return text.trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  convertToSbuddyProblem(amcProblem: AMCProblem, tenantId: string): Omit<Problem, 'id' | 'created_at' | 'updated_at'> {
    // Build comprehensive tags
    const tags = [
      `AMC10${amcProblem.test}`,
      `${amcProblem.year}`,
      'competition',
      'mathematics',
      ...(amcProblem.topics || [])
    ];

    return {
      title: `${amcProblem.year} AMC 10${amcProblem.test} Problem ${amcProblem.problemNumber}`,
      content: this.formatProblemContent(amcProblem),
      source: 'Art of Problem Solving',
      category: 'Competition',
      difficulty: amcProblem.difficulty || 'medium',
      subject: 'Mathematics',
      exam_type: 'AMC10',
      exam_year: amcProblem.year,
      problem_number: amcProblem.problemNumber,
      tags: [...new Set(tags)], // Remove duplicates
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

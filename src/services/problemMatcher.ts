import axios from 'axios';
import { ProblemMatch, Problem } from '../types';
import problemRepository from './problemRepository';
import config from '../config/env';

export class ProblemMatcherService {
  private readonly openaiApiKey: string;
  private readonly openaiEndpoint = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.openaiApiKey = config.OPENAI_API_KEY;
  }

  async findMatches(ocrText: string, tenantId: string): Promise<ProblemMatch[]> {
    try {
      // First try text similarity search using database
      const similarProblems = await problemRepository.findSimilarProblems(ocrText, tenantId, 10);

      if (this.openaiApiKey && similarProblems.length > 0) {
        // Use AI to rank and score the matches
        return await this.aiRankMatches(ocrText, similarProblems);
      } else {
        // Fallback to basic text similarity
        return await this.basicTextMatching(ocrText, similarProblems);
      }
    } catch (error) {
      console.error('Problem matching error:', error);
      return [];
    }
  }

  private async aiRankMatches(ocrText: string, candidates: Problem[]): Promise<ProblemMatch[]> {
    try {
      const prompt = this.buildMatchingPrompt(ocrText, candidates);

      const response = await axios.post(
        this.openaiEndpoint,
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at matching mathematical problems. Analyze the input problem and rank the candidate matches based on similarity.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      return await this.parseAIResponse(aiResponse, candidates);
    } catch (error) {
      console.error('AI matching error:', error);
      // Fallback to basic matching
      return await this.basicTextMatching(ocrText, candidates);
    }
  }

  private buildMatchingPrompt(ocrText: string, candidates: Problem[]): string {
    let prompt = `Input Problem Text:\n"${ocrText}"\n\n`;
    prompt += `Candidate Problems:\n`;

    candidates.forEach((problem, index) => {
      prompt += `${index + 1}. ID: ${problem.id}\n`;
      prompt += `   Title: ${problem.title}\n`;
      prompt += `   Content: ${problem.content.substring(0, 200)}...\n`;
      prompt += `   Subject: ${problem.subject}, Category: ${problem.category}\n\n`;
    });

    prompt += `Please analyze and return a JSON array with the following format for each match:\n`;
    prompt += `[\n`;
    prompt += `  {\n`;
    prompt += `    "problem_id": "uuid",\n`;
    prompt += `    "similarity_score": 0.95, // 0-1 scale\n`;
    prompt += `    "match_type": "exact|similar|partial",\n`;
    prompt += `    "reasoning": "brief explanation"\n`;
    prompt += `  }\n`;
    prompt += `]\n\n`;
    prompt += `Only include matches with similarity_score > 0.3. Order by similarity score (highest first).`;

    return prompt;
  }

  private async parseAIResponse(aiResponse: string, candidates: Problem[]): Promise<ProblemMatch[]> {
    try {
      // Extract JSON from the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const matches = JSON.parse(jsonMatch[0]);
      const problemMap = new Map(candidates.map(p => [p.id, p]));

      return matches
        .filter((match: any) => problemMap.has(match.problem_id))
        .map((match: any) => ({
          problem_id: match.problem_id,
          similarity_score: match.similarity_score,
          match_type: match.match_type,
          problem: problemMap.get(match.problem_id)!
        }))
        .sort((a: ProblemMatch, b: ProblemMatch) => b.similarity_score - a.similarity_score);
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return await this.basicTextMatching('', candidates);
    }
  }

  private async basicTextMatching(ocrText: string, candidates: Problem[]): Promise<ProblemMatch[]> {
    const matches: ProblemMatch[] = [];

    for (const problem of candidates) {
      const similarity = this.calculateTextSimilarity(ocrText, problem.content);

      if (similarity > 0.3) {
        let matchType: 'exact' | 'similar' | 'partial' = 'partial';
        if (similarity > 0.9) matchType = 'exact';
        else if (similarity > 0.7) matchType = 'similar';

        matches.push({
          problem_id: problem.id,
          similarity_score: similarity,
          match_type: matchType,
          problem
        });
      }
    }

    return matches.sort((a, b) => b.similarity_score - a.similarity_score);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity using word tokens
    const tokens1 = new Set(this.tokenize(text1.toLowerCase()));
    const tokens2 = new Set(this.tokenize(text2.toLowerCase()));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
  }

  private tokenize(text: string): string[] {
    // Remove non-alphanumeric characters and split by whitespace
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2); // Filter out very short tokens
  }

  async identifyProblemFromImage(ocrText: string, tenantId: string): Promise<{
    matches: ProblemMatch[];
    suggestions: {
      exam_type?: string;
      subject?: string;
      category?: string;
    };
  }> {
    const matches = await this.findMatches(ocrText, tenantId);
    const suggestions = this.extractMetadataSuggestions(ocrText);

    return { matches, suggestions };
  }

  private extractMetadataSuggestions(text: string): {
    exam_type?: string;
    subject?: string;
    category?: string;
  } {
    const suggestions: any = {};

    // Common exam patterns
    const examPatterns = {
      'AMC10': /AMC\s*10/i,
      'AMC12': /AMC\s*12/i,
      'AIME': /AIME/i,
      'MATHCOUNTS': /MATHCOUNTS/i,
      'SAT': /SAT/i,
      'AP Calculus': /AP\s*Calculus/i,
      'AP Statistics': /AP\s*Statistics/i
    };

    // Subject patterns
    const subjectPatterns = {
      'Mathematics': /math|algebra|geometry|calculus|trigonometry|statistics/i,
      'Physics': /physics|mechanics|thermodynamics|electricity/i,
      'Chemistry': /chemistry|chemical|molecule|reaction/i,
      'Biology': /biology|cell|organism|genetics/i
    };

    // Category patterns (for math)
    const categoryPatterns = {
      'Algebra': /equation|variable|solve|polynomial/i,
      'Geometry': /triangle|circle|angle|area|perimeter|volume/i,
      'Number Theory': /prime|divisible|modular|gcd|lcm/i,
      'Combinatorics': /permutation|combination|probability|counting/i,
      'Calculus': /derivative|integral|limit|continuous/i
    };

    // Check exam type
    for (const [exam, pattern] of Object.entries(examPatterns)) {
      if (pattern.test(text)) {
        suggestions.exam_type = exam;
        break;
      }
    }

    // Check subject
    for (const [subject, pattern] of Object.entries(subjectPatterns)) {
      if (pattern.test(text)) {
        suggestions.subject = subject;
        break;
      }
    }

    // Check category (assuming math if no subject found)
    if (!suggestions.subject || suggestions.subject === 'Mathematics') {
      for (const [category, pattern] of Object.entries(categoryPatterns)) {
        if (pattern.test(text)) {
          suggestions.category = category;
          break;
        }
      }
    }

    return suggestions;
  }
}

export default new ProblemMatcherService();
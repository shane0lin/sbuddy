import axios from 'axios';
import FormData from 'form-data';
import { OCRResult } from '../types';
import fs from 'fs';
import config from '../config/env';

interface ProblemSegment {
  text: string;
  bbox: number[];
  confidence: number;
  problemNumber?: number;
}

export class OCRService {
  private readonly serviceUrl: string;
  private readonly openaiApiKey: string;

  constructor() {
    this.serviceUrl = config.OCR_SERVICE_URL;
    this.openaiApiKey = config.OPENAI_API_KEY;
  }

  async processImage(imagePath: string): Promise<OCRResult> {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(imagePath));

      const response = await axios.post(`${this.serviceUrl}/ocr`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout
      });

      return this.parseOCRResponse(response.data);
    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        success: false,
        text: '',
        confidence: 0,
        problems_detected: 0,
        problems: []
      };
    }
  }

  async processImageBuffer(buffer: Buffer, filename: string): Promise<OCRResult> {
    try {
      const formData = new FormData();
      formData.append('file', buffer, filename);

      const response = await axios.post(`${this.serviceUrl}/ocr`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000,
      });

      return this.parseOCRResponse(response.data);
    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        success: false,
        text: '',
        confidence: 0,
        problems_detected: 0,
        problems: []
      };
    }
  }

  private parseOCRResponse(data: any): OCRResult {
    // Parse Surya OCR response format
    const result: OCRResult = {
      success: data.success || false,
      text: data.text || '',
      confidence: data.confidence || 0,
      problems_detected: 0,
      problems: []
    };

    if (data.text) {
      // Detect multiple problems in the text
      const problems = this.detectProblems(data.text, data.bboxes || []);
      result.problems_detected = problems.length;
      result.problems = problems;
    }

    return result;
  }

  private detectProblems(text: string, bboxes: any[] = []): Array<{text: string, bbox: number[], confidence: number}> {
    const problems: Array<{text: string, bbox: number[], confidence: number}> = [];

    // Enhanced problem detection patterns
    const problemPatterns = [
      { pattern: /(\d+)\.\s+/g, name: 'numbered_dot' },         // "1. ", "2. ", etc.
      { pattern: /Problem\s*(\d+)[\s:.]/gi, name: 'problem_n' }, // "Problem 1: ", etc.
      { pattern: /Question\s*(\d+)[\s:.]/gi, name: 'question_n' }, // "Question 1: ", etc.
      { pattern: /\((\d+)\)\s+/g, name: 'parentheses' },         // "(1) ", "(2) ", etc.
      { pattern: /(\d+)\)\s+/g, name: 'number_paren' },          // "1) ", "2) ", etc.
      { pattern: /\[(\d+)\]\s+/g, name: 'brackets' },            // "[1] ", "[2] ", etc.
      { pattern: /#(\d+)[\s:.]/g, name: 'hash' }                 // "#1 ", "#2 ", etc.
    ];

    let problemSegments: ProblemSegment[] = [];
    let bestPattern: { pattern: RegExp; name: string } | null = null;
    let maxMatches = 0;

    // Find the pattern that matches the most
    for (const { pattern, name } of problemPatterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > maxMatches) {
        maxMatches = matches.length;
        bestPattern = { pattern, name };
      }
    }

    if (bestPattern && maxMatches > 0) {
      // Split by the best pattern
      const parts = text.split(bestPattern.pattern);
      const matches = [...text.matchAll(bestPattern.pattern)];

      matches.forEach((match, index) => {
        const problemNumber = parseInt(match[1], 10);
        const problemText = parts[index + 1]?.trim() || '';

        if (problemText.length > 10) {
          problemSegments.push({
            text: problemText,
            bbox: bboxes[index] || [0, 0, 0, 0],
            confidence: 0.85,
            problemNumber
          });
        }
      });
    }

    // If no numbered patterns found, try to detect by structure
    if (problemSegments.length === 0) {
      problemSegments = this.detectByStructure(text, bboxes);
    }

    // If still nothing, treat as single problem
    if (problemSegments.length === 0 && text.trim().length > 0) {
      problemSegments.push({
        text: text.trim(),
        bbox: bboxes[0] || [0, 0, 0, 0],
        confidence: 0.9,
        problemNumber: 1
      });
    }

    return problemSegments.map(seg => ({
      text: seg.text,
      bbox: seg.bbox,
      confidence: seg.confidence
    }));
  }

  private detectByStructure(text: string, bboxes: any[] = []): ProblemSegment[] {
    const problems: ProblemSegment[] = [];

    // Split by double newlines (paragraph breaks)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);

    if (paragraphs.length > 1) {
      paragraphs.forEach((paragraph, index) => {
        problems.push({
          text: paragraph.trim(),
          bbox: bboxes[index] || [0, 0, 0, 0],
          confidence: 0.7,
          problemNumber: index + 1
        });
      });
    }

    return problems;
  }

  /**
   * Use AI to intelligently segment problems from OCR text
   * This provides better accuracy for complex layouts
   */
  async segmentProblemsWithAI(text: string): Promise<ProblemSegment[]> {
    try {
      const prompt = `You are analyzing text extracted from a math problem worksheet or exam. Your task is to identify and separate individual problems.

INPUT TEXT:
${text}

INSTRUCTIONS:
1. Identify each distinct problem in the text
2. For each problem, extract the complete problem statement
3. Assign a problem number to each (1, 2, 3, etc.)
4. Return a JSON array of problems

OUTPUT FORMAT (JSON):
[
  {
    "problemNumber": 1,
    "text": "Complete problem text here",
    "confidence": 0.95
  }
]

Return ONLY the JSON array, no other text.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at parsing and segmenting mathematical problems from OCR text. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const content = response.data.choices[0]?.message?.content || '[]';
      const problems = JSON.parse(content);

      return problems.map((p: any) => ({
        text: p.text,
        bbox: [0, 0, 0, 0],
        confidence: p.confidence || 0.9,
        problemNumber: p.problemNumber
      }));
    } catch (error) {
      console.error('AI problem segmentation error:', error);
      return [];
    }
  }

  /**
   * Enhanced problem detection that tries AI first, falls back to regex
   */
  async detectProblemsEnhanced(text: string, bboxes: any[] = []): Promise<ProblemSegment[]> {
    // Try AI-powered segmentation first
    const aiProblems = await this.segmentProblemsWithAI(text);

    if (aiProblems.length > 0) {
      console.log(`AI detected ${aiProblems.length} problems`);
      return aiProblems;
    }

    // Fallback to regex-based detection
    console.log('Falling back to regex-based problem detection');
    return this.detectProblems(text, bboxes);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.serviceUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('OCR service health check failed:', error);
      return false;
    }
  }
}

export default new OCRService();
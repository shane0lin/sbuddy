import axios from 'axios';
import FormData from 'form-data';
import { OCRResult } from '../types';
import fs from 'fs';
import config from '../config/env';

export class OCRService {
  private readonly serviceUrl: string;

  constructor() {
    this.serviceUrl = config.OCR_SERVICE_URL;
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

    // Split text by common problem indicators
    const problemPatterns = [
      /\d+\.\s/g,           // "1. ", "2. ", etc.
      /Problem\s*\d+/gi,    // "Problem 1", "Problem 2", etc.
      /Question\s*\d+/gi,   // "Question 1", etc.
      /\(\d+\)/g,           // "(1)", "(2)", etc.
      /\d+\)\s/g            // "1) ", "2) ", etc.
    ];

    let problemTexts: string[] = [];

    // Try to split by numbered patterns
    for (const pattern of problemPatterns) {
      const matches = text.split(pattern);
      if (matches.length > 1) {
        problemTexts = matches.filter(match => match.trim().length > 10);
        break;
      }
    }

    // If no patterns found, treat entire text as one problem
    if (problemTexts.length === 0) {
      problemTexts = [text];
    }

    problemTexts.forEach((problemText, index) => {
      if (problemText.trim()) {
        problems.push({
          text: problemText.trim(),
          bbox: bboxes[index] || [0, 0, 0, 0],
          confidence: 0.8 // Default confidence
        });
      }
    });

    return problems;
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
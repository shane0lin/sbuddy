import axios from 'axios';
import fs from 'fs';
import { OCRService } from '../../src/services/ocrService';

// Mock axios and fs
jest.mock('axios');
jest.mock('fs');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('OCRService', () => {
  let ocrService: OCRService;

  beforeEach(() => {
    ocrService = new OCRService();
    jest.clearAllMocks();
  });

  describe('processImage', () => {
    const mockImagePath = '/path/to/image.jpg';

    it('should successfully process an image and return OCR result', async () => {
      const mockResponse = {
        data: {
          success: true,
          text: 'What is 2 + 2?',
          confidence: 0.95,
          bboxes: [[10, 20, 100, 50]]
        }
      };

      mockedFs.createReadStream.mockReturnValue('mock-stream' as any);
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await ocrService.processImage(mockImagePath);

      expect(result.success).toBe(true);
      expect(result.text).toBe('What is 2 + 2?');
      expect(result.confidence).toBe(0.95);
      expect(result.problems_detected).toBe(1);
      expect(result.problems).toHaveLength(1);
      expect(result.problems[0].text).toBe('What is 2 + 2?');
    });

    it('should handle OCR service errors gracefully', async () => {
      mockedFs.createReadStream.mockReturnValue('mock-stream' as any);
      mockedAxios.post.mockRejectedValue(new Error('OCR service unavailable'));

      const result = await ocrService.processImage(mockImagePath);

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.problems_detected).toBe(0);
      expect(result.problems).toHaveLength(0);
    });

    it('should detect multiple problems in text', async () => {
      const mockResponse = {
        data: {
          success: true,
          text: '1. What is 2 + 2? 2. What is 3 + 3?',
          confidence: 0.9,
          bboxes: []
        }
      };

      mockedFs.createReadStream.mockReturnValue('mock-stream' as any);
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await ocrService.processImage(mockImagePath);

      expect(result.success).toBe(true);
      expect(result.problems_detected).toBe(2);
      expect(result.problems).toHaveLength(2);
      expect(result.problems[0].text).toContain('What is 2 + 2?');
      expect(result.problems[1].text).toContain('What is 3 + 3?');
    });

    it('should handle timeout errors', async () => {
      mockedFs.createReadStream.mockReturnValue('mock-stream' as any);
      mockedAxios.post.mockRejectedValue({ code: 'ECONNABORTED' });

      const result = await ocrService.processImage(mockImagePath);

      expect(result.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'OCR processing error:',
        { code: 'ECONNABORTED' }
      );
    });
  });

  describe('processImageBuffer', () => {
    it('should process buffer data successfully', async () => {
      const mockBuffer = Buffer.from('fake image data');
      const mockResponse = {
        data: {
          success: true,
          text: 'Solve for x: 2x + 3 = 7',
          confidence: 0.88
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await ocrService.processImageBuffer(mockBuffer, 'test.jpg');

      expect(result.success).toBe(true);
      expect(result.text).toBe('Solve for x: 2x + 3 = 7');
      expect(result.confidence).toBe(0.88);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/ocr',
        expect.any(Object),
        expect.objectContaining({
          timeout: 30000
        })
      );
    });

    it('should handle buffer processing errors', async () => {
      const mockBuffer = Buffer.from('invalid data');
      mockedAxios.post.mockRejectedValue(new Error('Invalid image format'));

      const result = await ocrService.processImageBuffer(mockBuffer, 'test.jpg');

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const result = await ocrService.healthCheck();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/health',
        { timeout: 5000 }
      );
    });

    it('should return false when service is unhealthy', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Service unavailable'));

      const result = await ocrService.healthCheck();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'OCR service health check failed:',
        expect.any(Error)
      );
    });

    it('should return false for non-200 status codes', async () => {
      mockedAxios.get.mockResolvedValue({ status: 500 });

      const result = await ocrService.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('detectProblems', () => {
    it('should detect problems with numbered format', () => {
      const text = '1. What is 2+2? 2. What is 3+3? 3. What is 4+4?';
      const mockService = new OCRService();

      // Access private method for testing
      const detectProblems = (mockService as any).detectProblems.bind(mockService);
      const problems = detectProblems(text, []);

      expect(problems).toHaveLength(3);
      expect(problems[0].text).toContain('What is 2+2?');
      expect(problems[1].text).toContain('What is 3+3?');
      expect(problems[2].text).toContain('What is 4+4?');
    });

    it('should detect problems with Problem format', () => {
      const text = 'Problem 1: Calculate the area. Problem 2: Find the perimeter.';
      const mockService = new OCRService();

      const detectProblems = (mockService as any).detectProblems.bind(mockService);
      const problems = detectProblems(text, []);

      expect(problems).toHaveLength(2);
      expect(problems[0].text).toContain('Calculate the area');
      expect(problems[1].text).toContain('Find the perimeter');
    });

    it('should treat entire text as one problem when no patterns found', () => {
      const text = 'This is a single problem without numbering.';
      const mockService = new OCRService();

      const detectProblems = (mockService as any).detectProblems.bind(mockService);
      const problems = detectProblems(text, []);

      expect(problems).toHaveLength(1);
      expect(problems[0].text).toBe(text);
    });

    it('should filter out very short text segments', () => {
      const text = '1. Hi 2. This is a proper length problem that should be included.';
      const mockService = new OCRService();

      const detectProblems = (mockService as any).detectProblems.bind(mockService);
      const problems = detectProblems(text, []);

      expect(problems).toHaveLength(1);
      expect(problems[0].text).toContain('This is a proper length problem');
    });
  });

  describe('cleanText', () => {
    it('should clean and normalize text properly', () => {
      const mockService = new OCRService();
      const cleanText = (mockService as any).cleanText.bind(mockService);

      const dirtyText = '  Multiple   spaces   and [wiki markup] and $$latex$$  ';
      const result = cleanText(dirtyText);

      expect(result).toBe('Multiple spaces and and latex');
    });

    it('should handle LaTeX delimiters', () => {
      const mockService = new OCRService();
      const cleanText = (mockService as any).cleanText.bind(mockService);

      const text = 'The equation $x^2 + y^2 = r^2$ represents a circle.';
      const result = cleanText(text);

      expect(result).toBe('The equation x^2 + y^2 = r^2 represents a circle.');
    });

    it('should remove wiki markup', () => {
      const mockService = new OCRService();
      const cleanText = (mockService as any).cleanText.bind(mockService);

      const text = 'This is [some markup] text with [more markup].';
      const result = cleanText(text);

      expect(result).toBe('This is text with .');
    });
  });
});
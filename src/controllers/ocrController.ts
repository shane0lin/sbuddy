import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ocrService from '../services/ocrService';
import problemMatcher from '../services/problemMatcher';
import { AuthRequest } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only image files are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  },
  fileFilter: fileFilter
});

export class OCRController {
  uploadMiddleware = upload.single('image');

  async processImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }

      // Process OCR
      const ocrResult = await ocrService.processImage(req.file.path);

      if (!ocrResult.success) {
        res.status(422).json({
          error: 'OCR processing failed',
          details: 'Could not extract text from the image'
        });
        return;
      }

      // Find matching problems
      const { matches, suggestions } = await problemMatcher.identifyProblemFromImage(
        ocrResult.text,
        req.user!.tenantId
      );

      // Clean up uploaded file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });

      res.json({
        ocr_result: ocrResult,
        matches: matches.slice(0, 5), // Return top 5 matches
        suggestions,
        detected_problems: ocrResult.problems_detected
      });
    } catch (error: any) {
      console.error('OCR processing error:', error);
      res.status(500).json({ error: 'Internal server error during OCR processing' });

      // Clean up file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
    }
  }

  async processImageBuffer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { image_data, filename } = req.body;

      if (!image_data) {
        res.status(400).json({ error: 'No image data provided' });
        return;
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(image_data, 'base64');

      const ocrResult = await ocrService.processImageBuffer(imageBuffer, filename || 'upload.jpg');

      if (!ocrResult.success) {
        res.status(422).json({
          error: 'OCR processing failed',
          details: 'Could not extract text from the image'
        });
        return;
      }

      const { matches, suggestions } = await problemMatcher.identifyProblemFromImage(
        ocrResult.text,
        req.user!.tenantId
      );

      res.json({
        ocr_result: ocrResult,
        matches: matches.slice(0, 5),
        suggestions,
        detected_problems: ocrResult.problems_detected
      });
    } catch (error: any) {
      console.error('OCR buffer processing error:', error);
      res.status(500).json({ error: 'Internal server error during OCR processing' });
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const isHealthy = await ocrService.healthCheck();

      if (isHealthy) {
        res.json({ status: 'healthy', ocr_service: 'available' });
      } else {
        res.status(503).json({ status: 'unhealthy', ocr_service: 'unavailable' });
      }
    } catch (error) {
      res.status(503).json({ status: 'error', ocr_service: 'error' });
    }
  }
}

export default new OCRController();
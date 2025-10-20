import { Request, Response } from 'express';

export class AdminController {
  async getStatus(req: Request, res: Response): Promise<void> {
    res.json({ status: 'Admin panel is running' });
  }
}

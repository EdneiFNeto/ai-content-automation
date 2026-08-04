import { Request, Response } from 'express';

class UserController {
  /**
   * Get all users
   */
  public async getAllUsers(req: Request, res: Response): Promise<void> {
    // Implementation logic here
    res.status(200).json({ message: 'List of users' });
  }
}

export default new UserController();

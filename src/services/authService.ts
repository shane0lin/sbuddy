import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../models/database';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/env';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = config.JWT_SECRET;
    this.jwtExpiresIn = config.JWT_EXPIRES_IN;
  }

  async register(email: string, password: string, tenantId?: string): Promise<{
    user: Omit<User, 'password_hash'>;
    token: string;
  }> {
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create tenant if not provided
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await this.createTenant(email.split('@')[1] || 'default');
    }

    const query = `
      INSERT INTO users (id, email, password_hash, tenant_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, subscription_tier, tenant_id, created_at, updated_at
    `;

    const values = [uuidv4(), email, passwordHash, finalTenantId];
    const result = await db.query(query, values);
    const user = result.rows[0];

    const token = this.generateToken(user.id, user.email, user.tenant_id);

    return { user, token };
  }

  async login(email: string, password: string): Promise<{
    user: Omit<User, 'password_hash'>;
    token: string;
  }> {
    const user = await this.getUserByEmail(email);
    if (!user || !user.password_hash) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user.id, user.email, user.tenant_id);

    const { password_hash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  async getUserById(id: string): Promise<Omit<User, 'password_hash'> | null> {
    const query = `
      SELECT id, email, subscription_tier, tenant_id, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  async updateUser(
    id: string,
    updates: Partial<Pick<User, 'email' | 'subscription_tier'>>
  ): Promise<Omit<User, 'password_hash'> | null> {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const query = `
      UPDATE users
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, subscription_tier, tenant_id, created_at, updated_at
    `;

    const values = [id, ...Object.values(updates)];
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.getUserByEmailWithPassword(id);
    if (!user || !user.password_hash) {
      throw new Error('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isOldPasswordValid) {
      throw new Error('Invalid current password');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    const query = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
    await db.query(query, [newPasswordHash, id]);
  }

  private async getUserByEmailWithPassword(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  private generateToken(userId: string, email: string, tenantId: string, role: string = 'user'): string {
    return jwt.sign(
      { userId, email, tenantId, role },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn } as jwt.SignOptions
    );
  }

  verifyToken(token: string): { userId: string; email: string; tenantId: string; role: string } {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        tenantId: decoded.tenantId,
        role: decoded.role || 'user'
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private async createTenant(name: string): Promise<string> {
    const query = `
      INSERT INTO tenants (id, name)
      VALUES ($1, $2)
      RETURNING id
    `;

    const tenantId = uuidv4();
    const result = await db.query(query, [tenantId, name]);
    return result.rows[0].id;
  }

  async getTenantUsers(tenantId: string): Promise<Omit<User, 'password_hash'>[]> {
    const query = `
      SELECT id, email, subscription_tier, tenant_id, created_at, updated_at
      FROM users
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [tenantId]);
    return result.rows;
  }

  async deleteUser(id: string, tenantId: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1 AND tenant_id = $2';
    const result = await db.query(query, [id, tenantId]);
    return (result.rowCount || 0) > 0;
  }

  async resetPassword(email: string): Promise<string> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate temporary password
    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const query = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
    await db.query(query, [passwordHash, user.id]);

    return tempPassword;
  }

  private generateTemporaryPassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}

export default new AuthService();
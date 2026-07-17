import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

// File Logging Helper for strict workspace diagnostics
const writeLog = (msg: string) => {
  const fileDest = path.join(__dirname, '../../auth_debug.log');
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(fileDest, entry);
  } catch (e) {
    // Fail silently
  }
};

/**
 * Authentication middleware adapted to Better Auth database sessions.
 * Inspects session records inside MongoDB and maps active sessions to Express request contexts.
 * Supports token extraction from both Authorization headers and HTTP cookies.
 */
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  let token: string | undefined = authHeader && authHeader.split(' ')[1];

  writeLog('--- Auth Middleware Triggered ---');
  writeLog(`Request URL: ${req.method} ${req.originalUrl}`);
  writeLog(`Authorization Header: ${authHeader ? 'Present' : 'Missing'}`);
  writeLog(`Raw Cookie Header: ${req.headers.cookie ? req.headers.cookie : 'Missing'}`);

  // Fallback: extract token from HttpOnly cookies if Authorization header is missing
  if (!token && req.headers.cookie) {
    try {
      const cookieHeader = req.headers.cookie;
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const trimmed = cookie.trim();
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex !== -1) {
          const key = trimmed.slice(0, eqIndex);
          const value = trimmed.slice(eqIndex + 1);
          acc[key] = decodeURIComponent(value);
        }
        return acc;
      }, {} as Record<string, string>);
      
      token = cookies['better-auth.session_token'] || cookies['__secure-better-auth.session_token'];
      writeLog(`Cookie-extracted Token: ${token ? 'Found' : 'Not Found'}`);
    } catch (e: any) {
      writeLog(`Cookie parsing failed: ${e.message}`);
    }
  }

  // Parse the raw token value from Better Auth's signed format (<token>.<signature>)
  if (token) {
    token = decodeURIComponent(token).split('.')[0];
  }

  writeLog(`Final token parsed for DB validation: ${token ? token : 'None'}`);

  if (!token) {
    writeLog('Verification failed: Access token missing.');
    res.status(401).json({ error: 'Access token missing or unauthorized' });
    return;
  }

  try {
    const db = mongoose.connection.db;
    if (!db) {
      writeLog('Verification failed: Database connection is not ready.');
      res.status(500).json({ error: 'Database connection is not ready' });
      return;
    }

    // Better Auth saves session documents in the 'session' collection
    const session = await db.collection('session').findOne({ token });
    if (!session) {
      writeLog(`Verification failed: Session record not found in DB for token: ${token}`);
      res.status(403).json({ error: 'Access token is invalid or inactive' });
      return;
    }

    writeLog(`Session found in DB. UserId in session: ${session.userId.toString()}`);

    // Validate that the session is not expired
    if (new Date(session.expiresAt) < new Date()) {
      writeLog(`Verification failed: Session is expired. Expiry: ${session.expiresAt}`);
      res.status(403).json({ error: 'Access token has expired' });
      return;
    }

    // Find the user document in the 'user' collection by its primary identifier _id or id
    let user = await db.collection('user').findOne({ _id: session.userId });
    if (!user) {
      writeLog(`User not found by _id object. Querying by id key string...`);
      user = await db.collection('user').findOne({ id: session.userId });
    }
    
    // If session.userId is stored as a string, check by converting to ObjectId
    if (!user && typeof session.userId === 'string') {
      try {
        writeLog(`User not found by direct id. Attempting ObjectId cast lookup...`);
        user = await db.collection('user').findOne({
          _id: new mongoose.Types.ObjectId(session.userId)
        });
      } catch (err: any) {
        writeLog(`ObjectId cast failed: ${err.message}`);
      }
    }

    if (!user) {
      writeLog(`Verification failed: Associated user record not found in DB for ID: ${session.userId}`);
      res.status(403).json({ error: 'User associated with session not found' });
      return;
    }

    writeLog(`Verification succeeded! User authenticated: ${user.email} (ID: ${user._id.toString()})`);

    // Attach identity properties to the request context
    req.user = {
      userId: user._id.toString(),
      email: user.email,
    };
    
    next();
  } catch (error: any) {
    writeLog(`System Exception during auth verification: ${error.stack || error.message}`);
    res.status(500).json({ error: 'Internal authentication validation error' });
  }
};
export default authenticateToken;

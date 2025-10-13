import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import enhancedAuthService from '../services/enhancedAuthService';

// Type definition for passport-apple
declare module 'passport-apple' {
  export interface AppleStrategyOptions {
    clientID: string;
    teamID: string;
    keyID: string;
    key: string;
    callbackURL: string;
    scope?: string[];
  }
  export default class AppleStrategy {
    constructor(
      options: AppleStrategyOptions,
      verify: (accessToken: any, refreshToken: any, idToken: any, profile: any, done: any) => void
    );
  }
}

const AppleStrategy = require('passport-apple');

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.API_URL}/api/v1/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          const result = await enhancedAuthService.findOrCreateOAuthUser(
            email,
            'google',
            profile.id
          );

          return done(null, result);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
}

// Apple OAuth Strategy
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID) {
  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        key: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        callbackURL: `${process.env.API_URL}/api/v1/auth/apple/callback`,
        scope: ['email'],
      },
      async (accessToken: any, refreshToken: any, idToken: any, profile: any, done: any) => {
        try {
          const email = profile.email;
          if (!email) {
            return done(new Error('No email found in Apple profile'), undefined);
          }

          const result = await enhancedAuthService.findOrCreateOAuthUser(
            email,
            'apple',
            profile.sub
          );

          return done(null, result);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
}

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;

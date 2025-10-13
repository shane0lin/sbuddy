import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import config from './env';
import enhancedAuthService from '../services/enhancedAuthService';

// Import passport-apple without types (package doesn't have TypeScript definitions)
const AppleStrategy = require('passport-apple');

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackURL: `${config.API_URL}/api/v1/auth/google/callback`,
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

// Apple OAuth Strategy (optional)
if (config.APPLE_CLIENT_ID && config.APPLE_TEAM_ID && config.APPLE_KEY_ID && config.APPLE_PRIVATE_KEY) {
  passport.use(
    new AppleStrategy(
      {
        clientID: config.APPLE_CLIENT_ID,
        teamID: config.APPLE_TEAM_ID,
        keyID: config.APPLE_KEY_ID,
        key: config.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        callbackURL: `${config.API_URL}/api/v1/auth/apple/callback`,
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

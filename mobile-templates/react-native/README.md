# Sbuddy React Native Mobile App

Cross-platform mobile application for Sbuddy study platform built with React Native and TypeScript.

## Features

- ✅ Email/password authentication
- ✅ Google & Apple Sign-In
- ✅ Camera integration for OCR
- ✅ Problem recognition and matching
- ✅ Study set management
- ✅ Spaced repetition system
- ✅ Gamification (points, levels, achievements)
- ✅ Offline support
- ✅ Dark mode

## Prerequisites

- Node.js 18+
- React Native CLI
- Xcode 14+ (for iOS)
- Android Studio (for Android)
- CocoaPods (for iOS)

## Installation

```bash
# Install dependencies
npm install

# iOS only: Install pods
cd ios && pod install && cd ..
```

## Configuration

1. Create `.env` file:

```env
API_BASE_URL=https://api.sbuddy.com/api/v1
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_CLIENT_ID=your-apple-client-id
```

2. Configure OAuth:

**iOS (info.plist)**:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR_CLIENT_ID</string>
    </array>
  </dict>
</array>
```

**Android (AndroidManifest.xml)**:
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="com.sbuddy" />
</intent-filter>
```

## Running the App

### Development

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Production Build

```bash
# iOS
cd ios
fastlane ios release

# Android
cd android
./gradlew assembleRelease
```

## Project Structure

```
src/
├── api/
│   └── client.ts         # API client with authentication
├── components/
│   ├── Camera.tsx        # Camera component for OCR
│   ├── ProblemCard.tsx   # Problem display component
│   └── StudyCard.tsx     # Spaced repetition card
├── screens/
│   ├── Auth/
│   │   ├── LoginScreen.tsx
│   │   └── RegisterScreen.tsx
│   ├── Camera/
│   │   └── CameraScreen.tsx
│   ├── Study/
│   │   ├── StudySetsScreen.tsx
│   │   ├── ReviewScreen.tsx
│   │   └── StatsScreen.tsx
│   └── Profile/
│       └── ProfileScreen.tsx
├── navigation/
│   └── AppNavigator.tsx  # Navigation setup
├── store/
│   ├── auth.ts           # Auth state
│   ├── problems.ts       # Problems state
│   └── study.ts          # Study state
├── utils/
│   ├── secureStorage.ts  # Secure token storage
│   └── offline.ts        # Offline sync
└── App.tsx
```

## Key Components

### API Client

```typescript
import api from './api/client';

// Login
const { user, tokens } = await api.login('user@example.com', 'password');

// Process image
const result = await api.processImage(imageUri);

// Get due cards
const cards = await api.getDueCards(20);
```

### Camera Integration

```typescript
import { launchCamera } from 'react-native-image-picker';

const takePhoto = async () => {
  const result = await launchCamera({
    mediaType: 'photo',
    quality: 0.8,
  });

  if (result.assets?.[0]?.uri) {
    const ocrResult = await api.processImage(result.assets[0].uri);
    // Handle OCR result
  }
};
```

### State Management

```typescript
import { useSelector, useDispatch } from 'react-redux';
import { login } from './store/auth';

const dispatch = useDispatch();
const user = useSelector((state) => state.auth.user);

// Login
await dispatch(login({ email, password }));
```

## Features Implementation

### Authentication Flow

1. User opens app
2. Check for saved tokens
3. If tokens exist, validate and auto-login
4. If no tokens, show login screen
5. After login, save tokens securely
6. On logout, clear tokens

### OCR Workflow

1. User taps camera button
2. Take photo or select from gallery
3. Upload to `/ocr/process-multi`
4. Display detected problems
5. Match with repository
6. Allow user to add to study set

### Spaced Repetition

1. Fetch due cards on home screen
2. Display card with problem
3. User attempts problem
4. Rate difficulty (0-5)
5. Submit review to update schedule
6. Show next card

### Offline Support

- Cache API responses in SQLite
- Queue mutations for sync
- Sync on reconnect
- Show offline indicator

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e:ios
npm run test:e2e:android
```

## Troubleshooting

### iOS Build Fails

```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

### Android Build Fails

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Metro Bundler Issues

```bash
npm start -- --reset-cache
```

## License

MIT

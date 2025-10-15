# Sbuddy Mobile App Templates

Pre-configured starter templates for building Sbuddy mobile applications.

---

## Available Templates

### 1. React Native (iOS & Android)
**Path**: `react-native/`
**Description**: Cross-platform mobile app using React Native and TypeScript
**Features**:
- Complete API integration
- Authentication flows
- Camera/OCR integration
- Study set management
- Spaced repetition UI
- Offline support

### 2. iOS (Swift)
**Path**: `ios-swift/`
**Description**: Native iOS app using SwiftUI
**Features**:
- Modern SwiftUI architecture
- Combine for reactive programming
- Native camera integration
- CoreData for offline storage

### 3. Android (Kotlin)
**Path**: `android-kotlin/`
**Description**: Native Android app using Jetpack Compose
**Features**:
- Jetpack Compose UI
- Kotlin Coroutines
- Room Database
- CameraX integration

---

## Quick Start

### React Native

```bash
cd react-native
npm install

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

### iOS (Swift)

```bash
cd ios-swift
open Sbuddy.xcodeproj
# Build and run in Xcode
```

### Android (Kotlin)

```bash
cd android-kotlin
./gradlew assembleDebug
# Or open in Android Studio
```

---

## Configuration

### API Endpoint

Edit `config.ts` (React Native) or equivalent config file:

```typescript
export const API_CONFIG = {
  baseURL: 'https://api.sbuddy.com/api/v1',
  timeout: 30000
};
```

### Environment Variables

Create `.env` file:

```
API_BASE_URL=https://api.sbuddy.com/api/v1
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_CLIENT_ID=your-apple-client-id
```

---

## Features Included

### ✅ Authentication
- Email/password login and registration
- Google Sign-In
- Apple Sign-In
- Biometric authentication
- Secure token storage

### ✅ OCR & Problem Recognition
- Camera integration
- Image capture and upload
- Multi-problem detection
- Problem matching

### ✅ Study Sets
- Create and manage study sets
- Add/remove problems
- Browse public sets
- Share sets

### ✅ Spaced Repetition
- Due cards dashboard
- Review interface
- Progress tracking
- Statistics visualization

### ✅ Gamification
- Points and levels
- Achievements
- Leaderboards
- Daily challenges

### ✅ Offline Support
- Local database caching
- Sync on reconnect
- Queue pending operations

---

## Architecture

### State Management
- **React Native**: Redux Toolkit + RTK Query
- **iOS**: Combine + SwiftUI @State
- **Android**: ViewModel + StateFlow

### Networking
- **React Native**: Axios with interceptors
- **iOS**: URLSession with async/await
- **Android**: Retrofit + OkHttp

### Local Storage
- **React Native**: AsyncStorage + SQLite
- **iOS**: UserDefaults + CoreData
- **Android**: SharedPreferences + Room

### Navigation
- **React Native**: React Navigation
- **iOS**: NavigationStack
- **Android**: Jetpack Navigation

---

## Customization

### Theming

All templates support light/dark mode and customizable themes.

**React Native**:
```typescript
// theme.ts
export const theme = {
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    text: '#000000'
  }
};
```

**iOS**:
```swift
// Theme.swift
struct Theme {
    static let primaryColor = Color.blue
    static let secondaryColor = Color.purple
}
```

**Android**:
```kotlin
// Theme.kt
object SbuddyTheme {
    val PrimaryColor = Color(0xFF007AFF)
    val SecondaryColor = Color(0xFF5856D6)
}
```

---

## Testing

### React Native
```bash
# Unit tests
npm test

# E2E tests (Detox)
npm run test:e2e:ios
npm run test:e2e:android
```

### iOS
```bash
# Unit tests
xcodebuild test -scheme Sbuddy -destination 'platform=iOS Simulator,name=iPhone 14'

# UI tests
xcodebuild test -scheme SbuddyUITests
```

### Android
```bash
# Unit tests
./gradlew test

# Instrumented tests
./gradlew connectedAndroidTest
```

---

## Build & Release

### React Native

**iOS**:
```bash
cd ios
fastlane ios release
```

**Android**:
```bash
cd android
./gradlew assembleRelease
```

### iOS (Native)
```bash
xcodebuild archive -scheme Sbuddy -archivePath build/Sbuddy.xcarchive
xcodebuild -exportArchive -archivePath build/Sbuddy.xcarchive -exportPath build/
```

### Android (Native)
```bash
./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

---

## Deployment

### App Store (iOS)

1. Configure signing in Xcode
2. Archive the app
3. Upload to App Store Connect
4. Submit for review

### Google Play (Android)

1. Generate signed bundle
2. Upload to Google Play Console
3. Complete store listing
4. Submit for review

---

## Support

- **Documentation**: See individual template READMEs
- **API Reference**: [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md)
- **Issues**: https://github.com/sbuddy/mobile/issues

---

## License

MIT License - See LICENSE file

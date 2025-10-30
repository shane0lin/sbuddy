# Mobile App Conversion Plan

## Project: Convert public/viewer/ to iOS/Android Mobile App

**Date**: 2025-10-29
**Target Platforms**: iOS and Android
**Current Tech**: Pure HTML/CSS/JavaScript viewer
**Chosen Approach**: Ionic Capacitor

---

## Why Capacitor?

✅ **Minimal code changes** - Wraps existing HTML/CSS/JS without rewriting
✅ **Native features** - Camera, file system, notifications, preferences
✅ **Cross-platform** - Single codebase for iOS and Android
✅ **App store ready** - Can publish to App Store and Google Play
✅ **Modern & maintained** - Active development by Ionic team
✅ **Great tooling** - CLI, live reload, debugging support

---

## Alternative Approaches Considered

### 1. Progressive Web App (PWA)
- **Pros**: Simplest approach, no app store, installable from browser
- **Cons**: Limited native features, no app store presence
- **Verdict**: Too limited for native file access and offline features

### 2. React Native
- **Pros**: Truly native UI components, excellent performance
- **Cons**: Complete rewrite required (HTML → React)
- **Verdict**: Too much effort, overkill for current needs

### 3. Flutter
- **Pros**: Great performance, beautiful UI, single codebase
- **Cons**: Requires rewrite in Dart, steep learning curve
- **Verdict**: Better for greenfield projects

---

## Implementation Plan

### Phase 1: Setup & Configuration

**1.1 Install Capacitor**
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init
```

**1.2 Project Configuration**
- App name: "AMC Study Buddy"
- Bundle ID: `com.sbuddy.amcviewer`
- Web directory: `public/viewer/`
- Configure capacitor.config.ts

**1.3 Add Platforms**
```bash
npx cap add ios
npx cap add android
```

**Deliverables**:
- ✓ Capacitor initialized
- ✓ iOS and Android projects created
- ✓ Basic app configuration complete

---

### Phase 2: Mobile Optimization

**2.1 CSS/UI Adjustments**
- Increase touch targets to 44x44px minimum (iOS guidelines)
- Add safe area insets for iPhone notch/Dynamic Island
- Optimize font sizes for mobile (16px minimum)
- Improve button spacing and padding
- Test landscape and portrait orientations

**2.2 Replace localStorage with Native Storage**
- Install: `npm install @capacitor/preferences`
- Replace `localStorage.getItem/setItem` with `Preferences.get/set`
- Update `studyPlan.js` to use Capacitor Preferences API
- Migrate existing localStorage data on first launch

**2.3 Offline-First Data Strategy**
- Bundle `crawled_data/` JSON files in app assets
- Load problems from local files instead of network
- Implement caching strategy for images/diagrams
- Add "last synced" timestamp indicator

**2.4 Enhanced Mobile Features**
- Pull-to-refresh on problem list
- Swipe gestures for navigation
- Haptic feedback on interactions (iOS)
- Loading states and skeletons

**Deliverables**:
- ✓ Mobile-friendly UI with proper touch targets
- ✓ Native storage implementation
- ✓ Offline problem browsing
- ✓ Mobile UX enhancements

---

### Phase 3: Native Features Integration

**3.1 Native File System**
- Install: `npm install @capacitor/filesystem`
- Replace file download with native file save
- Replace file upload with native file picker
- Save study plans to Documents directory
- Support share functionality (iOS Share Sheet, Android Share)

**3.2 App Assets**
- Create app icon (1024x1024 source)
- Generate iOS icon sizes (multiple resolutions)
- Generate Android adaptive icons
- Create splash screens for both platforms
- Configure launch screens

**3.3 Platform-Specific Adaptations**

**iOS:**
- Handle safe area insets (notch, home indicator)
- Configure status bar style (light/dark)
- Implement iOS-style navigation patterns
- Add haptic feedback

**Android:**
- Handle back button navigation
- Configure status bar and navigation bar colors
- Implement Material Design patterns
- Add Android splash screen (Android 12+)

**3.4 Permissions**
- Configure Info.plist (iOS) for file access
- Configure AndroidManifest.xml for permissions
- Request runtime permissions where needed

**Deliverables**:
- ✓ Native file save/load for study plans
- ✓ Professional app icons and splash screens
- ✓ Platform-specific UI polish
- ✓ All required permissions configured

---

### Phase 4: Testing & Deployment

**4.1 iOS Testing**
- Test on iPhone simulator (multiple sizes)
- Test on physical iPhone device
- Test iPad (if supporting tablets)
- Verify safe area handling
- Test all navigation flows
- Verify file save/load functionality

**4.2 Android Testing**
- Test on Android emulator (various versions)
- Test on physical Android device
- Test different screen sizes
- Verify back button behavior
- Test all navigation flows
- Verify file save/load functionality

**4.3 Performance Testing**
- Measure app launch time
- Test with large datasets (100+ problems)
- Monitor memory usage
- Test offline functionality
- Verify smooth scrolling

**4.4 Build for Production**

**iOS:**
```bash
npx cap sync ios
npx cap open ios
# Build in Xcode:
# - Archive
# - Upload to App Store Connect
# - Submit for review
```

**Android:**
```bash
npx cap sync android
npx cap open android
# Build in Android Studio:
# - Generate signed APK/AAB
# - Upload to Google Play Console
# - Submit for review
```

**4.5 App Store Preparation**
- App screenshots (iPhone, iPad, Android)
- App description and keywords
- Privacy policy URL
- Support URL/contact
- Age rating and categories

**Deliverables**:
- ✓ Tested on iOS devices
- ✓ Tested on Android devices
- ✓ Production builds created
- ✓ App store listings prepared
- ✓ Ready for submission

---

## Key Technical Changes

### Current Structure
```
public/viewer/
├── index.html          # Problem list
├── problem.html        # Problem detail
├── studyPlan.html      # Study plan manager
├── studyPlan.js        # Study plan logic
└── clearPlans.html     # Utility page
```

### Changes Required

**1. studyPlan.js**
```javascript
// OLD: localStorage
localStorage.setItem('amc_study_plans', JSON.stringify(plans));

// NEW: Capacitor Preferences
import { Preferences } from '@capacitor/preferences';
await Preferences.set({ key: 'amc_study_plans', value: JSON.stringify(plans) });
```

**2. File Operations (studyPlan.html)**
```javascript
// OLD: Browser file download
const link = document.createElement('a');
link.href = url;
link.download = 'file.json';

// NEW: Native file save
import { Filesystem } from '@capacitor/filesystem';
await Filesystem.writeFile({
  path: 'study-plans.json',
  data: jsonData,
  directory: Directory.Documents
});
```

**3. Data Loading**
```javascript
// OLD: Network fetch
fetch('../../crawled_data/amc_2012_10a_problems.json')

// NEW: Bundled asset
fetch('/assets/data/amc_2012_10a_problems.json')
// Or use Filesystem to read from app bundle
```

**4. Safe Area CSS**
```css
/* Add to all pages */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## Offline Data Strategy

### Bundled Data
- Include all `crawled_data/*.json` files in app bundle
- Copy to `public/viewer/assets/data/` during build
- Configure Capacitor to include these assets

### Update Mechanism (Future)
- Check for updates on app launch (when online)
- Download new problem sets in background
- Store in Filesystem.Data directory
- Merge with bundled data

---

## App Configuration

### capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sbuddy.amcviewer',
  appName: 'AMC Study Buddy',
  webDir: 'public/viewer',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#667eea',
      showSpinner: false
    }
  }
};

export default config;
```

---

## Dependencies to Install

```json
{
  "dependencies": {
    "@capacitor/core": "^5.5.0",
    "@capacitor/ios": "^5.5.0",
    "@capacitor/android": "^5.5.0",
    "@capacitor/preferences": "^5.0.6",
    "@capacitor/filesystem": "^5.1.4",
    "@capacitor/share": "^5.0.6",
    "@capacitor/splash-screen": "^5.0.6",
    "@capacitor/haptics": "^5.0.6"
  },
  "devDependencies": {
    "@capacitor/cli": "^5.5.0"
  }
}
```

---

## Timeline Estimate

- **Phase 1** (Setup): 2-3 hours
- **Phase 2** (Mobile Optimization): 4-6 hours
- **Phase 3** (Native Features): 6-8 hours
- **Phase 4** (Testing & Deployment): 8-10 hours

**Total**: ~20-27 hours

---

## Success Criteria

✓ App installs and launches on iOS and Android
✓ All viewer features work offline
✓ Study plans save/load using native file system
✓ UI is mobile-optimized with proper touch targets
✓ No crashes or major bugs
✓ Smooth 60fps scrolling and navigation
✓ App passes iOS App Store review
✓ App passes Google Play review

---

## Future Enhancements

- Push notifications for study reminders
- Camera integration for problem capture (OCR)
- Cloud sync for study plans (Firebase/Supabase)
- Dark mode support
- Widgets (iOS 14+, Android)
- Apple Pencil support (iPad)
- Share problems to social media
- In-app purchases for premium features

---

## References

- [Capacitor Docs](https://capacitorjs.com/docs)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Android Material Design](https://material.io/design)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy](https://support.google.com/googleplay/android-developer/answer/9859751)

---

**Status**: Planning Complete - Ready to implement
**Next Step**: Phase 1.1 - Install Capacitor

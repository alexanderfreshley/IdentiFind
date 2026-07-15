# IdentiFind Mobile

React Native / Expo mobile app for the IdentiFind identity monitoring platform.

## Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- iOS: Xcode 15+ (Mac only)
- Android: Android Studio with an emulator configured

## Setup

```bash
cd mobile
npm install
cp .env.example .env
# Edit .env — set EXPO_PUBLIC_API_URL to your machine's LAN IP
#   Windows: ipconfig → IPv4 Address
#   e.g. EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
```

Make sure your Next.js backend is running (`npm run dev` in the parent folder).

## Running

```bash
# Start the Expo dev server
npm start

# Open on iOS Simulator (Mac only)
npm run ios

# Open on Android Emulator
npm run android
```

## Building

```bash
# Development build (includes dev client for debugging)
eas build --platform ios --profile development
eas build --platform android --profile development

# Production build
eas build --platform all --profile production
```

## Project Structure

```
mobile/
├── app/
│   ├── _layout.tsx          # Root layout (auth provider + query client)
│   ├── index.tsx            # Entry point — redirects based on auth
│   ├── (auth)/
│   │   ├── login.tsx        # OAuth sign-in screen
│   │   └── callback.tsx     # Deep-link OAuth callback handler
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar navigator
│       ├── index.tsx        # Dashboard (risk score, findings)
│       ├── alerts.tsx       # Full alerts list
│       ├── accounts.tsx     # Connected accounts
│       └── profile.tsx      # Profile & settings
├── components/
│   └── ui/
│       ├── RiskScoreRing.tsx
│       ├── FindingCard.tsx
│       └── SkeletonLoader.tsx
├── constants/
│   └── colors.ts            # Brand color palette
├── hooks/
│   ├── useAuth.tsx          # Auth context + OAuth flow
│   └── useScan.ts           # React Query hooks for scan data
└── lib/
    ├── api.ts               # API client (calls existing Next.js backend)
    ├── storage.ts           # expo-secure-store wrapper
    └── types.ts             # Shared TypeScript types
```

## Phase Roadmap

| Phase | Focus | Month |
|-------|-------|-------|
| 1 | Foundation (this scaffold) | June 2026 |
| 2 | Core screens (full feature parity) | July–Aug 2026 |
| 3 | Push notifications + background scans | Sept 2026 |
| 4 | Biometrics, polish, accessibility | Oct 2026 |
| 5 | Beta & app store submission | Nov 2026 |
| 6 | Launch buffer | Dec 2026 |

## OAuth Setup

Each OAuth provider needs the mobile redirect URI added to its allowed list:

```
identifind://auth/callback
```

Add this in addition to the existing web callback URLs in each provider's developer console.
The client IDs are the same as in the web `.env` — copy them to `mobile/.env`.

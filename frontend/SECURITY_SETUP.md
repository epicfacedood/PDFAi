# Security Setup Guide

## 🔐 Authentication & IP Whitelisting

This PDF AI system includes two layers of security:

### 1. IP Whitelisting

Edit `src/middleware.ts` and update the `ALLOWED_IPS` array:

```typescript
const ALLOWED_IPS = [
  "127.0.0.1", // localhost
  "::1", // localhost IPv6
  "192.168.1.0/24", // local network range
  "203.0.113.1", // your office IP
  "198.51.100.0/24", // your network range
];
```

### 2. Passcode Authentication

#### Option A: Environment Variable (Recommended)

Add to your `.env.local` file:

```
PDF_AI_PASSCODE=YourSecurePasscode123!
```

#### Option B: Direct Configuration

Edit `src/app/api/auth/route.ts`:

```typescript
const VALID_PASSCODE = "YourSecurePasscode123!";
```

## 🚀 Default Credentials

**Default Passcode:** `PDFAi2024!`

⚠️ **IMPORTANT:** Change this before deploying to production!

## 🔒 Security Features

- **IP Whitelisting**: Only allowed IPs can access the site
- **Passcode Protection**: Additional authentication layer
- **Session Management**: 24-hour authentication cookies
- **Brute Force Protection**: 1-second delay on failed attempts
- **Secure Logout**: Clears authentication cookies

## 📍 IP Address Detection

The system detects client IPs from:

1. `x-forwarded-for` header (for proxies/load balancers)
2. `x-real-ip` header (for reverse proxies)
3. Fallback to localhost

## 🛡️ Access Flow

1. User visits the site
2. Middleware checks IP whitelist
3. If IP allowed, checks for auth cookie
4. If not authenticated, redirects to login
5. User enters passcode
6. On success, sets 24-hour auth cookie
7. User can access the PDF AI system

## 🔧 Customization

### Change Session Duration

In `src/app/login/page.tsx`, modify the cookie max-age:

```javascript
document.cookie = "pdf-ai-auth=authenticated; path=/; max-age=86400"; // 24 hours
```

### Add More Security

Consider adding:

- Rate limiting
- HTTPS enforcement
- Additional authentication factors
- Audit logging

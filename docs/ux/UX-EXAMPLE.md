# UX Design: Authentication System

**Feature**: #201 (OAuth Authentication)  
**PRD**: [PRD-EXAMPLE.md](../prd/PRD-EXAMPLE.md)  
**Designer**: UX Designer Agent  
**Date**: January 28, 2026  
**Status**: Ready for Development

---

## 1. Design Overview

### Goals

**User Experience Goals**:
- 🎯 **Frictionless**: One-click OAuth login, <3 seconds to dashboard
- 🔒 **Trustworthy**: Clear security indicators, familiar OAuth flows
- ♿ **Accessible**: WCAG 2.1 AA compliant, keyboard navigation
- 📱 **Responsive**: Works on desktop, tablet, mobile

**Design Principles**:
1. **Minimal friction**: Reduce clicks to login (target: 2 clicks)
2. **Clear affordances**: Obvious login buttons, provider logos
3. **Progressive disclosure**: Show advanced options only when needed
4. **Error prevention**: Validate before submission, clear error messages

---

## 2. User Personas

### Primary: Sarah (Solo Developer)

**Context**: Sarah switches between laptop and desktop frequently. She wants quick login without remembering passwords.

**Pain Points**:
- Hates password managers
- Wants to stay logged in across devices
- Needs fast access to start coding

**Design Focus**: One-click GitHub login, persistent sessions

---

### Secondary: Mike (Engineering Manager)

**Context**: Mike needs to manage team access and audit agent actions. He uses company SSO (Microsoft).

**Pain Points**:
- Multiple logins are annoying
- Wants visibility into team activity
- Needs to enforce security policies

**Design Focus**: Microsoft OAuth, admin dashboard (future), clear audit logs

---

## 3. User Flows

### Flow 1: First-Time Login (GitHub OAuth)

```
┌─────────────────┐
│  Landing Page   │
│                 │
│  "Get Started"  │
└────────┬────────┘
         │
         │ Click "Get Started"
         ▼
┌─────────────────┐
│   Login Page    │
│                 │
│ ┌─────────────┐ │
│ │ GitHub      │ │◄── Primary CTA
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ Microsoft   │ │◄── Secondary option
│ └─────────────┘ │
└────────┬────────┘
         │
         │ Click "GitHub"
         ▼
┌─────────────────┐
│  GitHub.com     │
│  Authorization  │
│                 │
│  "Authorize     │
│   AgentX?"      │
└────────┬────────┘
         │
         │ Click "Authorize"
         ▼
┌─────────────────┐
│   Dashboard     │
│                 │
│  Welcome Modal  │◄── First-time only
│  "Let's set up  │
│   your profile" │
└────────┬────────┘
         │
         │ Click "Continue"
         ▼
┌─────────────────┐
│   Dashboard     │
│   (Projects)    │
└─────────────────┘
```

**Step Count**: 4 clicks (Landing → Login → Authorize → Continue)  
**Time**: ~10 seconds (including GitHub redirect)

---

### Flow 2: Returning User Login

```
┌─────────────────┐
│  Landing Page   │
└────────┬────────┘
         │
         │ Already authenticated?
         │ Check localStorage
         │
         ▼
    ┌────────┐
    │ Token  │ Yes ──────► Dashboard (skip login)
    │ valid? │
    └────┬───┘
         │ No
         ▼
┌─────────────────┐
│   Login Page    │
│                 │
│  "Welcome back" │◄── Personalized message
│                 │
│  Click GitHub   │
└────────┬────────┘
         │
         │ Already authorized on GitHub
         │ (no re-authorization needed)
         │
         ▼
┌─────────────────┐
│   Dashboard     │
│   (Projects)    │
└─────────────────┘
```

**Step Count**: 2 clicks (Landing → Login → Dashboard)  
**Time**: ~3 seconds (no GitHub authorization page)

---

### Flow 3: Session Expired (Token Refresh)

```
┌─────────────────┐
│   Dashboard     │
│   (Browsing)    │
└────────┬────────┘
         │
         │ API call with expired token
         ▼
┌─────────────────┐
│  Background:    │
│  Auto-refresh   │◄── Transparent to user
│  using refresh  │
│  token          │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │Refresh │ Success ──► Continue (no interruption)
    │ valid? │
    └────┬───┘
         │ Failed
         ▼
┌─────────────────┐
│   Toast:        │
│  "Session       │
│   expired,      │
│   please log in"│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Login Page    │
└─────────────────┘
```

**User Experience**: Seamless refresh (no interruption if refresh token valid)

---

## 4. Wireframes

### 4.1 Login Page (Desktop)

```
┌────────────────────────────────────────────────────────────┐
│  AgentX Logo                                    [?] Help   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                                                            │
│              Welcome to AgentX                             │
│              ──────────────────                            │
│          AI agents that work like a real team              │
│                                                            │
│                                                            │
│    ┌──────────────────────────────────────────────┐       │
│    │  🐙  Sign in with GitHub                     │       │
│    └──────────────────────────────────────────────┘       │
│                                                            │
│    ┌──────────────────────────────────────────────┐       │
│    │  🪟  Sign in with Microsoft                  │       │
│    └──────────────────────────────────────────────┘       │
│                                                            │
│                                                            │
│    By signing in, you agree to our Terms and Privacy      │
│                                                            │
│                                                            │
│              Don't have an account?                        │
│              OAuth creates one automatically               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Key Elements**:
- **Logo**: Top-left, links to home
- **Headline**: Value proposition above CTA
- **Primary CTA**: GitHub button (larger, more prominent)
- **Secondary CTA**: Microsoft button (slightly smaller)
- **Legal**: Terms and privacy link (required for OAuth)
- **Help**: Question mark icon for OAuth explanation

**Visual Design**:
- GitHub button: Black with Octocat icon
- Microsoft button: Blue (#0078D4) with Windows icon
- Button size: 280px wide, 48px tall (large touch target)
- Spacing: 16px between buttons

---

### 4.2 Login Page (Mobile)

```
┌─────────────────────────┐
│  ☰   AgentX      [?]    │
├─────────────────────────┤
│                         │
│                         │
│   Welcome to AgentX     │
│   ───────────────       │
│   AI agents that work   │
│   like a real team      │
│                         │
│                         │
│  ┌───────────────────┐  │
│  │ 🐙 GitHub        │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │ 🪟 Microsoft     │  │
│  └───────────────────┘  │
│                         │
│                         │
│  Terms • Privacy        │
│                         │
└─────────────────────────┘
```

**Mobile Optimizations**:
- Hamburger menu for navigation
- Full-width buttons (minus 32px padding)
- Larger font size for readability (18px)
- Condensed copy (fewer words)

---

### 4.3 Dashboard (Post-Login)

```
┌────────────────────────────────────────────────────────────┐
│  AgentX    [Projects] [Agents] [Settings]     👤 Sarah ▼  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Welcome back, Sarah! 👋                                   │
│                                                            │
│  Recent Projects                                           │
│  ────────────────                                          │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  🚀 AgentX Refactor            Last active: 2h ago   │ │
│  │  Status: In Progress           5 agents working      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  📱 Mobile App UI               Last active: 1d ago   │ │
│  │  Status: Ready                  Waiting for UX       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [+ New Project]                                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**User Profile Dropdown**:
```
┌───────────────────────┐
│  👤 Sarah             │
│  sarah@example.com    │
├───────────────────────┤
│  ⚙️  Settings         │
│  🔑 API Keys          │
│  📊 Usage             │
│  📖 Documentation     │
├───────────────────────┤
│  🚪 Log Out           │
└───────────────────────┘
```

---

## 5. Component Specifications

### 5.1 OAuth Button Component

**Anatomy**:
```
┌──────────────────────────────────────┐
│  [Icon]  Sign in with [Provider]    │
└──────────────────────────────────────┘
   16px      24px text      16px
```

**States**:
- **Default**: Provider color, white text
- **Hover**: 10% darker, subtle shadow
- **Active**: 20% darker, pressed appearance
- **Loading**: Spinner replaces icon, text "Signing in..."
- **Disabled**: 50% opacity, no hover effect

**Accessibility**:
- `role="button"`
- `aria-label="Sign in with GitHub"`
- Keyboard: Enter/Space to activate
- Focus: 2px outline, high contrast

---

### 5.2 Welcome Modal (First-Time Users)

**Content**:
```
┌────────────────────────────────────┐
│  Welcome to AgentX!          [✕]  │
├────────────────────────────────────┤
│                                    │
│  Let's personalize your            │
│  experience                        │
│                                    │
│  What's your role?                 │
│  ○ Solo Developer                  │
│  ○ Engineering Manager             │
│  ○ Student/Learning                │
│                                    │
│  What's your primary language?     │
│  [C#  ▼]                          │
│                                    │
│  [Skip]              [Continue →] │
│                                    │
└────────────────────────────────────┘
```

**Behavior**:
- Appears only on first login
- Can be dismissed (never shown again)
- Data saved to user profile
- Used to customize onboarding

---

## 6. Interaction Design

### 6.1 Error Handling

**Error States**:

| Error | Trigger | User Message | Action |
|-------|---------|--------------|--------|
| OAuth denied | User clicks "Cancel" | "Login cancelled. You can try again anytime." | Return to login |
| OAuth timeout | GitHub doesn't respond | "Authorization timed out. Please try again." | Retry button |
| Network error | No internet | "Connection lost. Check your internet." | Retry button |
| Server error | Auth service down | "Something went wrong. We're on it!" | Contact support |

**Error Toast Component**:
```
┌────────────────────────────────────┐
│  ⚠️  Login cancelled                │
│  You can try again anytime.        │
│                          [Dismiss] │
└────────────────────────────────────┘
```

**Position**: Top-right corner  
**Duration**: 5 seconds (auto-dismiss)  
**Color**: Orange for warnings, red for errors

---

### 6.2 Loading States

**Login Button Loading**:
```
Before:  [🐙 Sign in with GitHub]
During:  [⏳ Signing in...]
After:   [✓ Success] (brief flash, then redirect)
```

**Duration**: Typically 1-2 seconds for OAuth redirect

---

## 7. Accessibility

### WCAG 2.1 AA Compliance

**Checklist**:
- ✅ **1.4.3 Contrast**: Minimum 4.5:1 ratio (text), 3:1 (buttons)
- ✅ **2.1.1 Keyboard**: All functionality via keyboard
- ✅ **2.4.7 Focus Visible**: Clear focus indicators (2px outline)
- ✅ **3.3.1 Error Identification**: Errors clearly described
- ✅ **4.1.2 Name, Role, Value**: ARIA labels for buttons

**Screen Reader Announcements**:
- "Sign in with GitHub button"
- "Authorization in progress" (live region)
- "Login successful, navigating to dashboard"

**Keyboard Navigation**:
- Tab: Move between buttons
- Enter/Space: Activate button
- Escape: Dismiss modal/toast

---

## 8. Responsive Design

### Breakpoints

| Size | Width | Layout |
|------|-------|--------|
| Mobile | <768px | Stacked, full-width buttons |
| Tablet | 768-1024px | Centered, fixed-width (600px) |
| Desktop | >1024px | Centered, fixed-width (800px) |

### Mobile Considerations

- **Touch Targets**: Minimum 44x44px (Apple HIG)
- **Scrolling**: Prevent body scroll when modal open
- **Viewport**: `<meta name="viewport" content="width=device-width, initial-scale=1">`

---

## 9. Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-github` | `#24292e` | GitHub button background |
| `--color-microsoft` | `#0078d4` | Microsoft button background |
| `--color-text-on-dark` | `#ffffff` | Button text color |
| `--color-error` | `#dc2626` | Error messages |
| `--color-success` | `#16a34a` | Success indicators |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-family` | `Inter, sans-serif` | Body text |
| `--font-size-headline` | `32px` | Page headline |
| `--font-size-button` | `16px` | Button text |
| `--font-weight-button` | `600` | Button text |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-button` | `48px` | Button height |
| `--space-gap` | `16px` | Gap between buttons |
| `--space-page-padding` | `32px` | Page left/right padding |

---

## 10. Prototypes

### Interactive Prototype

**Figma Link**: [View Prototype](https://figma.com/proto/agentx-auth)

**Flows Included**:
1. First-time login (GitHub)
2. Returning user login
3. Error handling (OAuth denied)
4. Session expired (token refresh)

**How to Use**:
1. Click "GitHub" button to see OAuth flow
2. Click "Cancel" to see error state
3. Use keyboard (Tab, Enter) to test accessibility

---

## 11. Developer Handoff

### Assets

**Exported from Figma**:
- `/assets/icons/github-logo.svg` (24x24px)
- `/assets/icons/microsoft-logo.svg` (24x24px)
- `/assets/icons/loading-spinner.svg` (animated)

**Design System**:
- All tokens available in [design-tokens.json](../../design-system/tokens.json)
- Component library: [Storybook](http://localhost:6006)

### Implementation Notes

**CSS Framework**: Tailwind CSS  
**Component Library**: React (Shadcn UI)

**Example Button Component** (reference only, see codebase for actual implementation):
```
Component: OAuthButton
Props:
  - provider: 'github' | 'microsoft'
  - onClick: () => void
  - loading: boolean
  - disabled: boolean

Styling: Uses design tokens from tailwind.config.js
Accessibility: Built-in ARIA labels, keyboard handlers
```

---

## 12. Success Metrics

### Quantitative

| Metric | Target | Measurement |
|--------|--------|-------------|
| Login Success Rate | >95% | Analytics (login_success / login_attempts) |
| Time to Dashboard | <3s (p95) | Performance monitoring |
| Error Rate | <5% | Error tracking (Sentry) |
| Accessibility Score | 100 | Lighthouse audit |

### Qualitative

- User satisfaction: CSAT survey (target >4.5/5)
- Ease of use: "How easy was it to log in?" (target >4/5)
- Trust: "Do you feel your account is secure?" (target >4.5/5)

---

## 13. Future Enhancements

### Phase 2 (Post-Launch)

- **Social Login**: Google, LinkedIn OAuth
- **Passwordless**: Email magic link
- **MFA**: TOTP for high-security accounts

### Phase 3 (Enterprise)

- **SSO**: SAML 2.0 for enterprises
- **Custom Branding**: White-label login page
- **Session Management**: Admin dashboard to view active sessions

---

## 14. References

- **PRD**: [PRD-EXAMPLE.md](../prd/PRD-EXAMPLE.md)
- **Figma**: [Design Files](https://figma.com/file/agentx-auth)
- **WCAG 2.1**: [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- **Material Design**: [Button Patterns](https://material.io/components/buttons)

---

## Changelog

- 2026-01-28: Initial UX design
- 2026-01-28: Added mobile wireframes
- 2026-01-28: Finalized accessibility checklist

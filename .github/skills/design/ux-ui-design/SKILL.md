---
name: ux-ui-design
description: 'Comprehensive guide for UX/UI design including wireframing, prototyping, user flows, accessibility, and production-ready HTML prototypes.'
---

# UX/UI Design & Prototyping

> **Purpose**: Best practices for creating user-centered designs, wireframes, prototypes, and production-ready HTML/CSS interfaces.

---

## Table of Contents

1. [User Research & Analysis](#user-research--analysis)
2. [Information Architecture](#information-architecture)
3. [Wireframing](#wireframing)
4. [User Flows](#user-flows)
5. [High-Fidelity Mockups](#high-fidelity-mockups)
6. [Interactive Prototypes](#interactive-prototypes)
7. [HTML/CSS Prototypes](#htmlcss-prototypes)
8. [Design Systems](#design-systems)
9. [Accessibility (A11y)](#accessibility-a11y)
10. [Responsive Design](#responsive-design)
11. [Usability Testing](#usability-testing)
12. [Best Practices](#best-practices)

---

## User Research & Analysis

### User Personas

```markdown
# Persona Template

## Primary Persona: [Name]

**Demographics:**
- Age: 28-35
- Occupation: Software Developer
- Tech Savviness: High
- Location: Urban areas

**Goals:**
- Complete tasks quickly
- Learn new features easily
- Integrate with existing tools

**Pain Points:**
- Complex navigation
- Slow loading times
- Unclear error messages

**Behaviors:**
- Uses keyboard shortcuts
- Prefers dark mode
- Works on multiple devices

**Quote:** "I need tools that work seamlessly and don't get in my way."
```

### User Journey Mapping

```markdown
# User Journey: [Task Name]

## Scenario
New user signs up and creates their first project

## Stages

1. **Awareness** (External)
   - User finds product via search/referral
   - Reads landing page
   - Emotions: 😐 Curious, cautious

2. **Consideration** (Landing Page)
   - Reviews features and pricing
   - Watches demo video
   - Emotions: 🙂 Interested, hopeful

3. **Sign Up** (Registration)
   - ✅ Opportunity: Simple form, social login
   - ⚠️ Pain Point: Too many required fields
   - Emotions: 😊 Excited but slightly frustrated

4. **Onboarding** (First Use)
   - ✅ Opportunity: Step-by-step wizard
   - ❌ Problem: No skip option, too slow
   - Emotions: 😐 Impatient

5. **First Value** (Project Created)
   - User successfully creates project
   - ✅ Success: Clear success feedback
   - Emotions: 😄 Accomplished

## Recommendations
- Reduce required fields to 3 (email, password, name)
- Add "Skip tour" option to onboarding
- Celebrate first project creation with animation
```

---

## Information Architecture

### Site Map

```
Home
├── Products
│   ├── Product A
│   ├── Product B
│   └── Pricing
├── Solutions
│   ├── For Developers
│   ├── For Teams
│   └── Enterprise
├── Resources
│   ├── Documentation
│   ├── Blog
│   ├── Tutorials
│   └── API Reference
├── Company
│   ├── About
│   ├── Careers
│   └── Contact
└── Dashboard (Authenticated)
    ├── Projects
    ├── Settings
    ├── Analytics
    └── Billing
```

### Content Inventory

| Page | Priority | Content Type | Status |
|------|----------|--------------|--------|
| Home | P0 | Marketing | ✅ Done |
| Dashboard | P0 | Application | 🚧 In Progress |
| Settings | P1 | Application | ⏳ Pending |
| Documentation | P1 | Content | ✅ Done |

---

## Wireframing

### Low-Fidelity Wireframes

**Purpose:** Quick sketches to explore layout and structure

**Tools:**
- Pen & Paper (fastest)
- Balsamiq (digital sketches)
- Figma/Sketch (basic shapes)

**Elements:**
- Boxes for content areas
- Lines for text
- X's for images
- Basic navigation

**Example: Dashboard Wireframe**

```
┌─────────────────────────────────────────────────────┐
│ Logo      [Search...]        [+New]  [👤]  [🔔]    │
├─────────────────────────────────────────────────────┤
│ ┌───────┐                                           │
│ │       │  Recent Projects                          │
│ │ Menu  │  ┌────────┐ ┌────────┐ ┌────────┐       │
│ │       │  │xxxxxxxx│ │xxxxxxxx│ │xxxxxxxx│       │
│ │ • Home│  │Project │ │Project │ │Project │       │
│ │ • Proj│  │   1    │ │   2    │ │   3    │       │
│ │ • Sets│  │        │ │        │ │        │       │
│ │       │  └────────┘ └────────┘ └────────┘       │
│ │       │                                           │
│ │       │  Activity Feed                            │
│ │       │  ───────────────────────────────────     │
│ │       │  • User A commented on Project 1          │
│ │       │  • Project 2 deployed successfully        │
│ │       │  • User B joined your team                │
│ └───────┘                                           │
└─────────────────────────────────────────────────────┘
```

### Mid-Fidelity Wireframes

**Purpose:** More detailed layout with actual content structure

**Include:**
- Real navigation labels
- Content hierarchy
- Form fields with labels
- Button text
- Placeholder images (sized correctly)

**Example: Login Page Wireframe**

```
┌─────────────────────────────────────┐
│                                     │
│         [Logo Image]                │
│                                     │
│      Welcome Back!                  │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Email                         │ │
│  │ [_________________________]   │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Password                      │ │
│  │ [_________________________]   │ │
│  │                  Forgot?     │ │
│  └───────────────────────────────┘ │
│                                     │
│   [    Sign In    ]                │
│                                     │
│   ─────── or ───────               │
│                                     │
│   [ Google ] [ GitHub ]            │
│                                     │
│   Don't have an account? Sign Up   │
│                                     │
└─────────────────────────────────────┘
```

---

## User Flows

### Flow Diagram Format

**Use:** Flowcharts to show user decision paths

```
Start: User on Homepage
    ↓
[Is logged in?]
    ├─ Yes → Dashboard
    └─ No → [Action]
              ├─ Click "Sign Up" → Registration Form
              │                      ↓
              │                    [Valid data?]
              │                      ├─ Yes → Create Account → Send Welcome Email → Dashboard
              │                      └─ No → Show Errors → Back to Form
              │
              └─ Click "Sign In" → Login Form
                                     ↓
                                   [Valid credentials?]
                                     ├─ Yes → Dashboard
                                     └─ No → Show Error → Back to Login
```

### Task Flow Template

```markdown
# Task Flow: Create New Project

**Actor:** Authenticated User
**Goal:** Create a new project
**Entry Point:** Dashboard

## Steps

1. User clicks "+ New Project" button
   - Location: Top navigation
   - State: Enabled (user authenticated)

2. Modal opens: "Create Project"
   - Fields:
     * Project Name (required)
     * Description (optional)
     * Template (dropdown)
     * Visibility (public/private toggle)
   - Actions:
     * [Cancel] (secondary)
     * [Create Project] (primary, disabled until name filled)

3. User fills in project name
   - Validation: Real-time
   - Error states: "Name already exists", "Invalid characters"

4. User selects template (optional)
   - Options: Blank, React App, API Server, etc.
   - Preview shown when hovering

5. User clicks "Create Project"
   - Loading state: Spinner on button
   - Button text: "Creating..."

6. Success
   - Modal closes
   - Redirect to project page
   - Toast: "Project created successfully!"

7. Error
   - Show error message in modal
   - Keep form data
   - Allow retry

## Edge Cases
- Network error: Show retry option
- Duplicate name: Suggest alternative names
- Quota exceeded: Show upgrade prompt
```

---

## High-Fidelity Mockups

### Design Tools
- **Figma** (recommended, collaborative)
- **Sketch** (Mac only)
- **Adobe XD**
- **Penpot** (open source)

### Mockup Checklist

**Visual Design:**
- [ ] Brand colors applied
- [ ] Typography hierarchy clear
- [ ] Proper spacing (8px grid)
- [ ] Icons consistent style
- [ ] Images high quality

**Components:**
- [ ] Buttons (primary, secondary, disabled)
- [ ] Forms (inputs, labels, validation)
- [ ] Navigation (active states)
- [ ] Cards/containers
- [ ] Modals/dialogs

**States:**
- [ ] Default
- [ ] Hover
- [ ] Active/Selected
- [ ] Disabled
- [ ] Loading
- [ ] Error
- [ ] Success
- [ ] Empty state

### Example: Button States

```
┌──────────────────────────────────────┐
│ Primary Button                       │
├──────────────────────────────────────┤
│ Default:   [ Save Changes ]          │
│ Hover:     [ Save Changes ] ↑        │
│ Active:    [ Save Changes ] ↓        │
│ Loading:   [ ⟳ Saving... ]           │
│ Disabled:  [ Save Changes ] (gray)   │
│ Success:   [ ✓ Saved! ]              │
└──────────────────────────────────────┘
```

---

## Interactive Prototypes

### Prototype Types

**1. Click-Through Prototype**
- Link screens together
- Show navigation flow
- No real functionality

**2. Interactive Prototype**
- Form validation simulation
- Dropdown menus work
- Tabs/accordions functional
- Animations included

**3. Code Prototype**
- Working HTML/CSS/JS
- Real data (can be mocked)
- Production-ready code

### Figma Prototyping

```
1. Connect frames with arrows
2. Set trigger: "On click"
3. Choose action: "Navigate to"
4. Select destination frame
5. Add transition: "Smart animate" or "Instant"
6. Preview prototype
7. Share link with stakeholders
```

### Interaction States

```markdown
# Button Interaction Spec

**Trigger:** Click "Submit" button

**States:**
1. Default → Loading (immediate)
   - Button disabled
   - Text: "Submitting..."
   - Spinner shown

2. Loading → Success (after 1-2s)
   - Button green
   - Text: "Success!"
   - Checkmark icon
   - Auto-close modal after 1s

3. Loading → Error (if fails)
   - Button red (briefly)
   - Text: "Try Again"
   - Error message below
   - Button re-enabled

4. Error → Default (after 2s)
   - Button returns to normal
   - Ready for retry
```

---

## HTML/CSS Prototypes

### Production-Ready HTML Prototype Structure

```
prototype/
├── index.html
├── css/
│   ├── reset.css
│   ├── variables.css
│   ├── components.css
│   └── main.css
├── js/
│   ├── main.js
│   └── components/
│       ├── modal.js
│       ├── dropdown.js
│       └── form-validation.js
├── images/
├── fonts/
└── README.md
```

### HTML Prototype Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Dashboard prototype">
    <title>Dashboard - Prototype</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    <!-- Styles -->
    <link rel="stylesheet" href="css/reset.css">
    <link rel="stylesheet" href="css/variables.css">
    <link rel="stylesheet" href="css/components.css">
    <link rel="stylesheet" href="css/main.css">
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar" role="navigation" aria-label="Main navigation">
        <div class="navbar-brand">
            <a href="/" class="logo" aria-label="Home">
                <img src="images/logo.svg" alt="Company Logo" width="120" height="40">
            </a>
        </div>

        <div class="navbar-menu">
            <a href="/dashboard" class="navbar-item" aria-current="page">Dashboard</a>
            <a href="/projects" class="navbar-item">Projects</a>
            <a href="/settings" class="navbar-item">Settings</a>
        </div>

        <div class="navbar-end">
            <button class="btn btn-primary" type="button">
                <span>+ New Project</span>
            </button>
            <div class="navbar-item">
                <button class="btn-icon" aria-label="Notifications">
                    <svg><!-- notification icon --></svg>
                </button>
                <button class="btn-icon" aria-label="User menu">
                    <img src="images/avatar.jpg" alt="User avatar" class="avatar">
                </button>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="container" id="main-content">
        <header class="page-header">
            <h1>Dashboard</h1>
            <p class="page-description">Welcome back! Here's what's happening with your projects.</p>
        </header>

        <!-- Stats Cards -->
        <section class="stats-grid" aria-label="Statistics">
            <div class="stat-card">
                <div class="stat-icon stat-icon-primary">
                    <svg><!-- icon --></svg>
                </div>
                <div class="stat-content">
                    <p class="stat-label">Total Projects</p>
                    <p class="stat-value">12</p>
                    <p class="stat-change stat-change-positive">
                        <span aria-label="Increased by">↑</span> 3 this month
                    </p>
                </div>
            </div>

            <!-- More stat cards... -->
        </section>

        <!-- Projects Grid -->
        <section class="section">
            <div class="section-header">
                <h2>Recent Projects</h2>
                <a href="/projects" class="link-primary">View all →</a>
            </div>

            <div class="grid">
                <article class="card project-card">
                    <div class="card-image">
                        <img src="images/project-1.jpg" alt="Project screenshot" loading="lazy">
                        <span class="badge badge-success">Active</span>
                    </div>
                    <div class="card-content">
                        <h3 class="card-title">
                            <a href="/projects/1">E-commerce Platform</a>
                        </h3>
                        <p class="card-description">
                            Modern e-commerce solution with React and Node.js
                        </p>
                        <div class="card-meta">
                            <span class="meta-item">
                                <svg><!-- icon --></svg>
                                Updated 2h ago
                            </span>
                            <span class="meta-item">
                                <svg><!-- icon --></svg>
                                3 members
                            </span>
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-secondary btn-sm">View</button>
                        <button class="btn btn-ghost btn-sm">Settings</button>
                    </div>
                </article>

                <!-- More project cards... -->
            </div>
        </section>
    </main>

    <!-- Modal Example -->
    <div class="modal" id="create-project-modal" role="dialog" aria-labelledby="modal-title" aria-hidden="true">
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <header class="modal-header">
                <h2 id="modal-title">Create New Project</h2>
                <button class="btn-close" aria-label="Close modal">
                    <svg><!-- close icon --></svg>
                </button>
            </header>

            <form class="modal-body" id="create-project-form">
                <div class="form-group">
                    <label for="project-name" class="form-label">
                        Project Name <span class="required" aria-label="required">*</span>
                    </label>
                    <input
                        type="text"
                        id="project-name"
                        name="name"
                        class="form-input"
                        placeholder="My Awesome Project"
                        required
                        aria-required="true"
                        aria-describedby="name-hint"
                    >
                    <p id="name-hint" class="form-hint">
                        Choose a descriptive name for your project
                    </p>
                    <p class="form-error" id="name-error" role="alert" aria-live="polite"></p>
                </div>

                <div class="form-group">
                    <label for="project-description" class="form-label">
                        Description
                    </label>
                    <textarea
                        id="project-description"
                        name="description"
                        class="form-textarea"
                        rows="3"
                        placeholder="What is this project about?"
                    ></textarea>
                </div>

                <div class="form-group">
                    <label for="project-template" class="form-label">
                        Template
                    </label>
                    <select id="project-template" name="template" class="form-select">
                        <option value="">Blank Project</option>
                        <option value="react">React App</option>
                        <option value="vue">Vue App</option>
                        <option value="api">REST API</option>
                    </select>
                </div>
            </form>

            <footer class="modal-footer">
                <button type="button" class="btn btn-secondary">Cancel</button>
                <button type="submit" form="create-project-form" class="btn btn-primary">
                    Create Project
                </button>
            </footer>
        </div>
    </div>

    <!-- Scripts -->
    <script src="js/main.js"></script>
</body>
</html>
```

### CSS Variables (Design Tokens)

```css
/* css/variables.css */
:root {
    /* Colors */
    --color-primary: #3b82f6;
    --color-primary-hover: #2563eb;
    --color-primary-light: #dbeafe;

    --color-secondary: #64748b;
    --color-secondary-hover: #475569;

    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-error: #ef4444;
    --color-info: #3b82f6;

    /* Neutrals */
    --color-gray-50: #f9fafb;
    --color-gray-100: #f3f4f6;
    --color-gray-200: #e5e7eb;
    --color-gray-300: #d1d5db;
    --color-gray-400: #9ca3af;
    --color-gray-500: #6b7280;
    --color-gray-600: #4b5563;
    --color-gray-700: #374151;
    --color-gray-800: #1f2937;
    --color-gray-900: #111827;

    /* Typography */
    --font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-family-mono: 'Fira Code', 'Courier New', monospace;

    --font-size-xs: 0.75rem;    /* 12px */
    --font-size-sm: 0.875rem;   /* 14px */
    --font-size-base: 1rem;     /* 16px */
    --font-size-lg: 1.125rem;   /* 18px */
    --font-size-xl: 1.25rem;    /* 20px */
    --font-size-2xl: 1.5rem;    /* 24px */
    --font-size-3xl: 1.875rem;  /* 30px */
    --font-size-4xl: 2.25rem;   /* 36px */

    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;

    /* Spacing (8px grid) */
    --space-1: 0.25rem;  /* 4px */
    --space-2: 0.5rem;   /* 8px */
    --space-3: 0.75rem;  /* 12px */
    --space-4: 1rem;     /* 16px */
    --space-5: 1.25rem;  /* 20px */
    --space-6: 1.5rem;   /* 24px */
    --space-8: 2rem;     /* 32px */
    --space-10: 2.5rem;  /* 40px */
    --space-12: 3rem;    /* 48px */
    --space-16: 4rem;    /* 64px */

    /* Border Radius */
    --radius-sm: 0.25rem;  /* 4px */
    --radius-md: 0.375rem; /* 6px */
    --radius-lg: 0.5rem;   /* 8px */
    --radius-xl: 0.75rem;  /* 12px */
    --radius-full: 9999px;

    /* Shadows */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);

    /* Transitions */
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);

    /* Z-index */
    --z-dropdown: 1000;
    --z-sticky: 1020;
    --z-fixed: 1030;
    --z-modal-backdrop: 1040;
    --z-modal: 1050;
    --z-popover: 1060;
    --z-tooltip: 1070;
}
```

### Component CSS

```css
/* css/components.css */

/* Buttons */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    line-height: 1.5;
    text-decoration: none;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    user-select: none;
}

.btn-primary {
    color: white;
    background-color: var(--color-primary);
    border-color: var(--color-primary);
}

.btn-primary:hover:not(:disabled) {
    background-color: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
}

.btn-primary:active:not(:disabled) {
    transform: translateY(1px);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Cards */
.card {
    background: white;
    border: 1px solid var(--color-gray-200);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: all var(--transition-base);
}

.card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
}

/* Forms */
.form-input,
.form-select,
.form-textarea {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    font-size: var(--font-size-base);
    line-height: 1.5;
    color: var(--color-gray-900);
    background-color: white;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    transition: border-color var(--transition-fast);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-input.is-invalid {
    border-color: var(--color-error);
}

.form-error {
    display: none;
    margin-top: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-error);
}

.form-input.is-invalid ~ .form-error {
    display: block;
}

/* Modal */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-modal);
    display: none;
    align-items: center;
    justify-content: center;
}

.modal.is-active {
    display: flex;
}

.modal-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
}

.modal-content {
    position: relative;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    background: white;
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    animation: modalFadeIn var(--transition-base);
}

@keyframes modalFadeIn {
    from {
        opacity: 0;
        transform: scale(0.95) translateY(-20px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}
```

### JavaScript for Interactivity

```javascript
// js/main.js

// Modal Management
class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.backdrop = this.modal.querySelector('.modal-backdrop');
        this.closeButtons = this.modal.querySelectorAll('[data-modal-close]');

        this.init();
    }

    init() {
        // Close on backdrop click
        this.backdrop?.addEventListener('click', () => this.close());

        // Close on close button click
        this.closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    open() {
        this.modal.classList.add('is-active');
        this.modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Focus first focusable element
        const firstFocusable = this.modal.querySelector('input, button, textarea, select');
        firstFocusable?.focus();
    }

    close() {
        this.modal.classList.remove('is-active');
        this.modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    isOpen() {
        return this.modal.classList.contains('is-active');
    }
}

// Form Validation
class FormValidator {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => {
            if (!this.validate()) {
                e.preventDefault();
            }
        });

        // Real-time validation
        const inputs = this.form.querySelectorAll('input[required], textarea[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('is-invalid')) {
                    this.validateField(input);
                }
            });
        });
    }

    validateField(field) {
        const error = field.parentElement.querySelector('.form-error');

        if (!field.validity.valid) {
            field.classList.add('is-invalid');
            if (error) {
                error.textContent = field.validationMessage;
            }
            return false;
        } else {
            field.classList.remove('is-invalid');
            if (error) {
                error.textContent = '';
            }
            return true;
        }
    }

    validate() {
        const inputs = this.form.querySelectorAll('input[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize modals
    const createProjectModal = new Modal('create-project-modal');

    // Open modal example
    document.querySelectorAll('[data-modal-open="create-project-modal"]').forEach(btn => {
        btn.addEventListener('click', () => createProjectModal.open());
    });

    // Initialize form validation
    if (document.getElementById('create-project-form')) {
        new FormValidator('create-project-form');
    }

    // Toast notifications
    window.showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('is-visible');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('is-visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };
});
```

---

## Design Systems

### Component Library Structure

```
Component Documentation
├── Foundations
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   ├── Icons
│   └── Grid
├── Components
│   ├── Buttons
│   ├── Forms
│   ├── Cards
│   ├── Modals
│   ├── Navigation
│   ├── Tables
│   └── Alerts
└── Patterns
    ├── Navigation Patterns
    ├── Form Patterns
    ├── Data Display
    └── Empty States
```

### Design Token Documentation

```markdown
# Color System

## Primary Colors
- **Primary**: #3b82f6 - Main brand color, CTAs, links
- **Primary Hover**: #2563eb - Hover state for primary actions
- **Primary Light**: #dbeafe - Backgrounds, hover effects

## Usage Rules
✅ **Do:**
- Use primary color for main CTAs
- Use primary light for hover states on cards
- Maintain 4.5:1 contrast ratio with white text

❌ **Don't:**
- Use primary for large backgrounds
- Mix primary with secondary in same component
- Use for error or warning states
```

---

## Accessibility (A11y)

### WCAG 2.1 AA Compliance Checklist

**Perceivable:**
- [ ] Text has 4.5:1 contrast ratio (3:1 for large text)
- [ ] Images have alt text
- [ ] Color is not the only way to convey information
- [ ] Text can be resized to 200% without loss of content

**Operable:**
- [ ] All functionality available via keyboard
- [ ] Focus indicators visible
- [ ] No keyboard traps
- [ ] Skip navigation links provided
- [ ] Sufficient time for reading and using content

**Understandable:**
- [ ] Page language declared (`<html lang="en">`)
- [ ] Labels provided for form inputs
- [ ] Error messages are clear and helpful
- [ ] Consistent navigation across pages

**Robust:**
- [ ] Valid HTML
- [ ] ARIA attributes used correctly
- [ ] Works with screen readers
- [ ] Status messages announced

### Screen Reader Markup

```html
<!-- Skip Navigation -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Landmarks -->
<nav role="navigation" aria-label="Main navigation">...</nav>
<main id="main-content">...</main>
<aside role="complementary" aria-label="Related articles">...</aside>

<!-- Form Labels -->
<label for="email">Email Address</label>
<input type="email" id="email" aria-required="true" aria-describedby="email-hint">
<p id="email-hint">We'll never share your email</p>

<!-- Live Regions -->
<div role="alert" aria-live="polite">
    Your changes have been saved
</div>

<!-- Button Labels -->
<button aria-label="Close modal">
    <svg aria-hidden="true"><!-- X icon --></svg>
</button>

<!-- Status Updates -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
    Loading complete. 5 results found.
</div>
```

### Keyboard Navigation

```javascript
// Trap focus in modal
function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    });
}
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile First Approach */
:root {
    --breakpoint-sm: 640px;   /* Small devices (phones) */
    --breakpoint-md: 768px;   /* Medium devices (tablets) */
    --breakpoint-lg: 1024px;  /* Large devices (desktops) */
    --breakpoint-xl: 1280px;  /* Extra large devices */
    --breakpoint-2xl: 1536px; /* Ultra wide */
}

/* Base styles (mobile) */
.container {
    padding: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
    .container {
        padding: 2rem;
    }
}

/* Desktop and up */
@media (min-width: 1024px) {
    .container {
        padding: 3rem;
        max-width: 1200px;
        margin: 0 auto;
    }
}
```

### Responsive Grid

```css
.grid {
    display: grid;
    gap: var(--space-4);

    /* Mobile: 1 column */
    grid-template-columns: 1fr;
}

@media (min-width: 640px) {
    .grid {
        /* Tablet: 2 columns */
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 1024px) {
    .grid {
        /* Desktop: 3 columns */
        grid-template-columns: repeat(3, 1fr);
    }
}

/* Auto-fit responsive grid */
.grid-auto {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
```

---

## Usability Testing

### Test Plan Template

```markdown
# Usability Test: [Feature Name]

## Objectives
- Validate that users can complete [primary task]
- Identify pain points in [specific flow]
- Measure task completion time

## Participants
- 5-8 users
- Mix of new and existing users
- Representative of target demographic

## Tasks

### Task 1: Create New Project
**Scenario:** "You want to start a new project. Please create one."

**Success Criteria:**
- User finds "New Project" button
- Completes form without errors
- Project appears in dashboard

**Metrics:**
- Task completion rate
- Time to complete
- Number of errors
- Satisfaction rating (1-5)

### Task 2: [Next Task]
...

## Test Script

**Introduction:**
"Thank you for participating. Today we're testing a new feature, not you. Please think aloud as you work. There are no wrong answers."

**During Test:**
- Observe silently
- Note confusion points
- Ask follow-up questions only after task attempt

**Debrief:**
- "What was the most difficult part?"
- "What would you change?"
- "Rate your overall experience 1-5"

## Results Template

| Task | Completion Rate | Avg Time | Errors | Satisfaction |
|------|----------------|----------|--------|--------------|
| Task 1 | 5/5 (100%) | 1m 23s | 0.4 | 4.6/5 |
| Task 2 | 4/5 (80%) | 2m 45s | 1.2 | 3.8/5 |

**Key Findings:**
1. Users struggled to find [element] - redesign needed
2. Form validation was unclear - add inline errors
3. Success state loved by all users - keep as is
```

---

## Best Practices

### ✅ DO

**Wireframing:**
- Start with lo-fi sketches
- Iterate quickly on paper first
- Focus on structure, not aesthetics
- Include annotations for interactions
- Test with real content, not lorem ipsum

**Design:**
- Follow 8px grid system
- Maintain consistent component library
- Use established design patterns
- Design for all states (empty, loading, error)
- Include accessibility from start

**Prototyping:**
- Create production-ready HTML/CSS
- Use semantic HTML5 elements
- Follow BEM or consistent naming
- Include ARIA attributes
- Test with keyboard and screen readers
- Validate HTML/CSS
- Optimize performance (images, CSS)

**Collaboration:**
- Document design decisions
- Share prototypes early and often
- Gather feedback from developers
- Version control design files
- Handoff with specifications

### ❌ DON'T

**Anti-patterns:**
- Skip user research
- Design in a vacuum
- Use placeholder content in final designs
- Ignore edge cases and error states
- Forget mobile/tablet breakpoints
- Neglect accessibility
- Hardcode values instead of using variables
- Mix design approaches (grid systems, naming)

**Performance:**
- Use large unoptimized images
- Inline all styles (use external CSS)
- Load unnecessary JavaScript
- Block rendering with scripts

---

## Tools & Resources

**Design Tools:**
- [Figma](https://figma.com) - Collaborative design
- [Sketch](https://sketch.com) - Mac design tool
- [Penpot](https://penpot.app) - Open source alternative

**Wireframing:**
- [Balsamiq](https://balsamiq.com) - Quick wireframes
- [Whimsical](https://whimsical.com) - Flowcharts & wireframes
- [Excalidraw](https://excalidraw.com) - Hand-drawn style

**Prototyping:**
- [CodePen](https://codepen.io) - Quick HTML/CSS/JS prototypes
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS
- [Bootstrap](https://getbootstrap.com) - Component framework

**Accessibility:**
- [WAVE](https://wave.webaim.org) - Accessibility checker
- [axe DevTools](https://www.deque.com/axe) - Browser extension
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

**Inspiration:**
- [Dribbble](https://dribbble.com)
- [Behance](https://behance.net)
- [awwwards](https://awwwards.com)

---

**Related Skills**:
- [Frontend/UI Development](../development/frontend-ui/SKILL.md)
- [React Framework](../development/react/SKILL.md)
- [Accessibility](../architecture/accessibility/SKILL.md)

---

**Version**: 1.0
**Last Updated**: February 5, 2026

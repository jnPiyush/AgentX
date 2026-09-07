# split-html-prototype-styles

> Source: [html-prototype-code.md](html-prototype-code.md)
> Source hash (LF-normalized original file): `6B8D0C210F8F1E0D6467AFB0A830DFB0F9437A2CF4F41B019E5D3F4F7F4083C2`
> Relocation manifest:
> - `## CSS Variables (Design Tokens)` -> original lines 200-439
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

## CSS Variables (Design Tokens)

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

 --font-size-xs: 0.75rem; /* 12px */
 --font-size-sm: 0.875rem; /* 14px */
 --font-size-base: 1rem; /* 16px */
 --font-size-lg: 1.125rem; /* 18px */
 --font-size-xl: 1.25rem; /* 20px */
 --font-size-2xl: 1.5rem; /* 24px */
 --font-size-3xl: 1.875rem; /* 30px */
 --font-size-4xl: 2.25rem; /* 36px */

 --font-weight-normal: 400;
 --font-weight-medium: 500;
 --font-weight-semibold: 600;
 --font-weight-bold: 700;

 /* Spacing (8px grid) */
 --space-1: 0.25rem; /* 4px */
 --space-2: 0.5rem; /* 8px */
 --space-3: 0.75rem; /* 12px */
 --space-4: 1rem; /* 16px */
 --space-5: 1.25rem; /* 20px */
 --space-6: 1.5rem; /* 24px */
 --space-8: 2rem; /* 32px */
 --space-10: 2.5rem; /* 40px */
 --space-12: 3rem; /* 48px */
 --space-16: 4rem; /* 64px */

 /* Border Radius */
 --radius-sm: 0.25rem; /* 4px */
 --radius-md: 0.375rem; /* 6px */
 --radius-lg: 0.5rem; /* 8px */
 --radius-xl: 0.75rem; /* 12px */
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

---

## Component CSS

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

---

# HTML/CSS Prototype Code Reference

> Extracted from [SKILL.md](../SKILL.md) for progressive disclosure. Load when building HTML prototypes.

---

## HTML Prototype Template

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
 <span aria-label="Increased by">(up)</span> 3 this month
 </p>
 </div>
 </div>

 <!-- More stat cards... -->
 </section>

 <!-- Projects Grid -->
 <section class="section">
 <div class="section-header">
 <h2>Recent Projects</h2>
 <a href="/projects" class="link-primary">View all -></a>
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

## JavaScript for Interactivity

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

# split-html-prototype-interactivity

> Source: [html-prototype-code.md](html-prototype-code.md)
> Source hash (LF-normalized original file): `6B8D0C210F8F1E0D6467AFB0A830DFB0F9437A2CF4F41B019E5D3F4F7F4083C2`
> Relocation manifest:
> - `## JavaScript for Interactivity` -> original lines 440-584
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

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

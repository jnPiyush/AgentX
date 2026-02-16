# Accessibility Implementation Patterns

> Extracted from [SKILL.md](../SKILL.md) for progressive disclosure. Load when implementing accessibility features.

---

## WCAG 2.1 AA Compliance Checklist

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

---

## Screen Reader Markup

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

---

## Keyboard Navigation

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

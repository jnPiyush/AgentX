# Responsive Design Patterns

> Extracted from [SKILL.md](../SKILL.md) for progressive disclosure. Load when implementing responsive layouts.

---

## Breakpoints

```css
/* Mobile First Approach */
:root {
 --breakpoint-sm: 640px; /* Small devices (phones) */
 --breakpoint-md: 768px; /* Medium devices (tablets) */
 --breakpoint-lg: 1024px; /* Large devices (desktops) */
 --breakpoint-xl: 1280px; /* Extra large devices */
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

---

## Responsive Grid

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

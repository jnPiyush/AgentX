---
name: "frontend-ui"
description: 'Build frontend UIs with HTML5, CSS3, and Tailwind CSS following accessibility and performance best practices. Use when creating responsive layouts, styling with Tailwind CSS, implementing accessible forms, optimizing frontend performance, or building common UI patterns.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 languages: ["html", "css", "javascript"]
 frameworks: ["tailwind", "bootstrap"]
 platforms: ["windows", "linux", "macos"]
---

# Frontend/UI Development

> **Purpose**: Production-ready frontend development standards for HTML, CSS, Tailwind CSS, and responsive design. 
> **Audience**: Frontend engineers building web interfaces with modern HTML/CSS and utility-first frameworks. 
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) frontend development patterns.

---

## When to Use This Skill

- Building responsive web layouts with HTML5 and CSS3
- Styling with Tailwind CSS utility classes
- Implementing accessible web forms
- Optimizing frontend loading performance
- Creating common UI layout patterns

## Prerequisites

- HTML5 and CSS3 fundamentals
- Node.js installed for Tailwind CSS build tools

## Quick Reference

| Need | Solution | Pattern |
|------|----------|---------|
| **Responsive layout** | Mobile-first with Tailwind | `flex md:grid grid-cols-3` |
| **Semantic HTML** | Use proper elements | `<nav>`, `<main>`, `<article>` |
| **Accessibility** | ARIA labels + keyboard nav | `aria-label="Close menu"` |
| **Color contrast** | WCAG AA minimum (4.5:1) | Use color tools for validation |
| **Typography** | Tailwind text utilities | `text-base md:text-lg` |
| **Spacing** | Consistent Tailwind scale | `p-4 md:p-6 lg:p-8` |

## Decision Tree

```
Building a frontend UI?
+-- Need a page layout?
|   +-- Simple landing page       -> Semantic HTML + Tailwind utilities
|   +-- Multi-column dashboard     -> CSS Grid with responsive breakpoints
|   +-- Sidebar + content          -> Flexbox with fixed/fluid split
+-- Need interactive components?
|   +-- Forms with validation      -> Semantic <form> + ARIA + native validation
|   +-- Modals / dialogs           -> <dialog> element + focus trap
|   +-- Navigation menus           -> <nav> + keyboard + aria-expanded
+-- Need styling approach?
|   +-- Utility-first, rapid dev   -> Tailwind CSS
|   +-- Pre-built components       -> Bootstrap or component library
|   +-- Custom design system       -> CSS custom properties + BEM
+-- Need accessibility audit?
|   -> Run WAVE / axe-core, fix contrast + ARIA + keyboard nav
+-- Need performance optimization?
    -> Defer scripts, lazy-load images, minimize CSS
```

## Core Rules

1. **Mobile-first responsive design** - Start with the smallest breakpoint and progressively enhance for larger screens; never design desktop-first.
2. **Semantic HTML over divs** - Use `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>` for structure; reserve `<div>` for styling-only wrappers.
3. **WCAG AA minimum** - Maintain 4.5:1 contrast ratio for text, provide visible focus indicators, and add `alt` on all images.
4. **Keyboard navigable** - Every interactive element MUST be reachable and operable via keyboard alone (Tab, Enter, Escape).
5. **No inline styles** - Use Tailwind utility classes or external CSS; inline styles break maintainability and cacheability.
6. **Design all states** - Every component MUST handle empty, loading, error, success, and disabled states.
7. **Consistent spacing scale** - Use the Tailwind spacing scale (4px increments) or an 8px grid; never use arbitrary pixel values.
8. **Viewport meta required** - Every HTML page MUST include `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.

---

## HTML5 Semantic Elements

```html
<!-- [PASS] GOOD: Semantic HTML structure -->
<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Page Title</title>
</head>
<body>
 <!-- Navigation -->
 <nav class="bg-white shadow-md">
 <ul class="flex space-x-4">
 <li><a href="#home">Home</a></li>
 <li><a href="#about">About</a></li>
 </ul>
 </nav>

 <!-- Main content -->
 <main class="container mx-auto px-4 py-8">
 <article class="prose lg:prose-xl">
 <h1>Article Title</h1>
 <p>Content goes here...</p>
 </article>
 
 <aside class="mt-8">
 <h2>Related Content</h2>
 </aside>
 </main>

 <!-- Footer -->
 <footer class="bg-gray-800 text-white p-6">
 <p>&copy; 2026 Company Name</p>
 </footer>
</body>
</html>

<!-- [FAIL] BAD: Non-semantic divs -->
<div class="nav">
 <div class="nav-item">Home</div>
</div>
<div class="content">
 <div class="post">...</div>
</div>
```

---

## Anti-Patterns

| Issue | Problem | Solution |
|-------|---------|----------|
| **Non-semantic HTML** | Using `<div>` for everything | Use `<nav>`, `<main>`, `<article>`, `<section>` |
| **Missing alt text** | Images without descriptions | Always add descriptive `alt` attributes |
| **Poor contrast** | Text hard to read | Use WCAG AA contrast ratio (4.5:1) |
| **No focus states** | Keyboard users can't navigate | Add visible focus indicators |
| **Fixed widths** | Not responsive | Use relative units and Tailwind breakpoints |
| **Inline styles** | Hard to maintain | Use Tailwind utilities or CSS classes |

---

## Resources

- **Tailwind CSS**: [tailwindcss.com](https://tailwindcss.com)
- **MDN Web Docs**: [developer.mozilla.org](https://developer.mozilla.org)
- **WCAG Guidelines**: [w3.org/WAI/WCAG21](https://www.w3.org/WAI/WCAG21/)
- **Can I Use**: [caniuse.com](https://caniuse.com)
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../Skills.md) - [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tailwind classes not applying | Check purge/content config in tailwind.config.js includes your template files |
| Accessibility audit failures | Add ARIA labels, ensure color contrast ratio >= 4.5:1, test keyboard navigation |
| Layout breaks on mobile | Use mobile-first responsive design, test with browser dev tools responsive mode |

## References

- [Tailwind A11y Css](references/tailwind-a11y-css.md)
- [Images Forms Layouts](references/images-forms-layouts.md)
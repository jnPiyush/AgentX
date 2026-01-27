---
description: 'Frontend UI development with HTML5, CSS3, and Tailwind CSS best practices'
---

# Frontend/UI Development

> **Purpose**: Production-ready frontend development standards for HTML, CSS, Tailwind CSS, and responsive design.  
> **Audience**: Frontend engineers building web interfaces with modern HTML/CSS and utility-first frameworks.  
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) frontend development patterns.

---

## Quick Reference

| Need | Solution | Pattern |
|------|----------|---------|
| **Responsive layout** | Mobile-first with Tailwind | `flex md:grid grid-cols-3` |
| **Semantic HTML** | Use proper elements | `<nav>`, `<main>`, `<article>` |
| **Accessibility** | ARIA labels + keyboard nav | `aria-label="Close menu"` |
| **Color contrast** | WCAG AA minimum (4.5:1) | Use color tools for validation |
| **Typography** | Tailwind text utilities | `text-base md:text-lg` |
| **Spacing** | Consistent Tailwind scale | `p-4 md:p-6 lg:p-8` |

---

## HTML5 Semantic Elements

```html
<!-- ✅ GOOD: Semantic HTML structure -->
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

<!-- ❌ BAD: Non-semantic divs -->
<div class="nav">
    <div class="nav-item">Home</div>
</div>
<div class="content">
    <div class="post">...</div>
</div>
```

---

## Tailwind CSS Best Practices

### Mobile-First Responsive Design

```html
<!-- ✅ GOOD: Mobile-first approach -->
<div class="
    flex flex-col          <!-- Mobile: stack vertically -->
    md:flex-row            <!-- Tablet+: horizontal -->
    gap-4 md:gap-6         <!-- Responsive spacing -->
">
    <div class="w-full md:w-1/3">Sidebar</div>
    <div class="w-full md:w-2/3">Content</div>
</div>

<!-- Typography scaling -->
<h1 class="
    text-2xl md:text-4xl lg:text-5xl
    font-bold
    leading-tight
">
    Responsive Heading
</h1>

<!-- Spacing patterns -->
<section class="
    p-4 md:p-6 lg:p-8
    mb-8 md:mb-12 lg:mb-16
">
    Content with responsive padding
</section>
```

### Layout Patterns

```html
<!-- Flexbox utilities -->
<div class="flex items-center justify-between">
    <span>Left</span>
    <span>Right</span>
</div>

<!-- Grid layouts -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div>Item 1</div>
    <div>Item 2</div>
    <div>Item 3</div>
</div>

<!-- Centering -->
<div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
        <h1>Centered Content</h1>
    </div>
</div>

<!-- Sticky header -->
<nav class="sticky top-0 z-50 bg-white shadow-md">
    Navigation
</nav>
```

### Color and Theming

```html
<!-- Design system colors -->
<button class="
    bg-blue-600 hover:bg-blue-700
    text-white
    px-4 py-2
    rounded-lg
    transition-colors duration-200
">
    Primary Button
</button>

<!-- Dark mode support -->
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
    Content adapts to theme
</div>

<!-- Custom colors via config -->
<!-- tailwind.config.js -->
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        secondary: '#9333EA',
      }
    }
  }
}
```

---

## Accessibility (A11y)

### ARIA Labels and Roles

```html
<!-- ✅ GOOD: Accessible navigation -->
<nav aria-label="Main navigation">
    <ul role="list">
        <li><a href="#home" aria-current="page">Home</a></li>
        <li><a href="#about">About</a></li>
    </ul>
</nav>

<!-- ✅ GOOD: Button with accessible label -->
<button 
    aria-label="Close menu"
    aria-expanded="false"
    class="p-2"
>
    <svg aria-hidden="true"><!-- Icon --></svg>
</button>

<!-- ✅ GOOD: Form accessibility -->
<form>
    <label for="email" class="block mb-2">
        Email Address
        <span class="text-red-600" aria-label="required">*</span>
    </label>
    <input 
        type="email"
        id="email"
        aria-required="true"
        aria-describedby="email-hint"
        class="w-full p-2 border rounded"
    />
    <p id="email-hint" class="text-sm text-gray-600">
        We'll never share your email
    </p>
</form>

<!-- Skip to content link -->
<a 
    href="#main-content"
    class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
>
    Skip to main content
</a>
```

### Focus States

```html
<!-- ✅ GOOD: Visible focus indicators -->
<button class="
    px-4 py-2
    bg-blue-600 text-white
    rounded
    focus:outline-none
    focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
">
    Accessible Button
</button>

<!-- ✅ GOOD: Keyboard navigable menu -->
<nav role="navigation">
    <button
        aria-expanded="false"
        aria-controls="menu"
        class="focus:ring-2 focus:ring-blue-500"
    >
        Menu
    </button>
    <ul id="menu" hidden class="...">
        <li><a href="#" class="focus:bg-blue-50">Item 1</a></li>
        <li><a href="#" class="focus:bg-blue-50">Item 2</a></li>
    </ul>
</nav>
```

---

## CSS Best Practices

### Custom CSS (When Tailwind Isn't Enough)

```css
/* Component-specific styles */
.custom-scrollbar::-webkit-scrollbar {
    width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
}

/* Custom animations */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

/* CSS Grid with named areas */
.layout {
    display: grid;
    grid-template-areas:
        "header header"
        "sidebar main"
        "footer footer";
    grid-template-columns: 250px 1fr;
    gap: 1rem;
}

.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.footer { grid-area: footer; }
```

---

## Responsive Images

```html
<!-- ✅ GOOD: Responsive image with srcset -->
<img
    src="image-800.jpg"
    srcset="
        image-400.jpg 400w,
        image-800.jpg 800w,
        image-1200.jpg 1200w
    "
    sizes="(max-width: 768px) 100vw, 800px"
    alt="Descriptive alt text"
    loading="lazy"
    class="w-full h-auto rounded-lg"
/>

<!-- ✅ GOOD: Picture element for art direction -->
<picture>
    <source 
        media="(min-width: 768px)"
        srcset="desktop-image.jpg"
    />
    <source 
        media="(min-width: 320px)"
        srcset="mobile-image.jpg"
    />
    <img 
        src="fallback.jpg"
        alt="Responsive image"
        class="w-full"
    />
</picture>

<!-- ✅ GOOD: Modern image formats -->
<picture>
    <source srcset="image.avif" type="image/avif" />
    <source srcset="image.webp" type="image/webp" />
    <img src="image.jpg" alt="Fallback" />
</picture>
```

---

## Forms

```html
<!-- ✅ GOOD: Accessible form with Tailwind -->
<form class="max-w-md mx-auto space-y-4">
    <!-- Text input -->
    <div>
        <label for="name" class="block mb-2 font-medium">
            Name
        </label>
        <input
            type="text"
            id="name"
            name="name"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
    </div>

    <!-- Select dropdown -->
    <div>
        <label for="country" class="block mb-2 font-medium">
            Country
        </label>
        <select
            id="country"
            name="country"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg"
        >
            <option value="">Select a country</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
        </select>
    </div>

    <!-- Checkbox -->
    <div class="flex items-center">
        <input
            type="checkbox"
            id="terms"
            name="terms"
            required
            class="w-4 h-4 text-blue-600"
        />
        <label for="terms" class="ml-2">
            I agree to the terms
        </label>
    </div>

    <!-- Submit button -->
    <button
        type="submit"
        class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg
               hover:bg-blue-700 focus:ring-4 focus:ring-blue-300
               transition-colors duration-200"
    >
        Submit
    </button>
</form>
```

---

## Performance Optimization

```html
<!-- ✅ GOOD: Resource hints -->
<head>
    <!-- Preconnect to external domains -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    
    <!-- DNS prefetch -->
    <link rel="dns-prefetch" href="https://api.example.com">
    
    <!-- Preload critical assets -->
    <link rel="preload" href="critical.css" as="style">
    <link rel="preload" href="hero-image.jpg" as="image">
</head>

<!-- ✅ GOOD: Lazy loading -->
<img src="image.jpg" loading="lazy" alt="Description" />
<iframe src="video.html" loading="lazy"></iframe>

<!-- ✅ GOOD: Async/defer scripts -->
<script src="analytics.js" async></script>
<script src="app.js" defer></script>
```

---

## Common Layout Patterns

### Card Grid

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
        <img src="card-image.jpg" alt="Card" class="w-full h-48 object-cover" />
        <div class="p-6">
            <h3 class="text-xl font-bold mb-2">Card Title</h3>
            <p class="text-gray-600 mb-4">Card description</p>
            <button class="text-blue-600 hover:text-blue-800">Read More →</button>
        </div>
    </div>
</div>
```

### Hero Section

```html
<section class="relative min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600">
    <div class="absolute inset-0 bg-black/40"></div>
    <div class="relative z-10 text-center text-white px-4">
        <h1 class="text-4xl md:text-6xl font-bold mb-4">
            Welcome to Our Site
        </h1>
        <p class="text-xl md:text-2xl mb-8">
            Build amazing things with Tailwind CSS
        </p>
        <button class="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100">
            Get Started
        </button>
    </div>
</section>
```

---

## Tailwind Configuration

```js
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        secondary: '#9333EA',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      spacing: {
        '128': '32rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}
```

---

## Common Pitfalls

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

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026

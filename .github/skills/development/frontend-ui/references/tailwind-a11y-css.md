# Tailwind CSS, Accessibility & CSS Best Practices

## Tailwind CSS Best Practices

### Mobile-First Responsive Design

```html
<!-- [PASS] GOOD: Mobile-first approach -->
<div class="
 flex flex-col <!-- Mobile: stack vertically -->
 md:flex-row <!-- Tablet+: horizontal -->
 gap-4 md:gap-6 <!-- Responsive spacing -->
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
<!-- [PASS] GOOD: Accessible navigation -->
<nav aria-label="Main navigation">
 <ul role="list">
 <li><a href="#home" aria-current="page">Home</a></li>
 <li><a href="#about">About</a></li>
 </ul>
</nav>

<!-- [PASS] GOOD: Button with accessible label -->
<button 
 aria-label="Close menu"
 aria-expanded="false"
 class="p-2"
>
 <svg aria-hidden="true"><!-- Icon --></svg>
</button>

<!-- [PASS] GOOD: Form accessibility -->
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
<!-- [PASS] GOOD: Visible focus indicators -->
<button class="
 px-4 py-2
 bg-blue-600 text-white
 rounded
 focus:outline-none
 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
">
 Accessible Button
</button>

<!-- [PASS] GOOD: Keyboard navigable menu -->
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

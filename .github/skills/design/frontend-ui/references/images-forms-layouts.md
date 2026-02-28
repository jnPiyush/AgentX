# Responsive Images, Forms & Layout Patterns

## Responsive Images

```html
<!-- [PASS] GOOD: Responsive image with srcset -->
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

<!-- [PASS] GOOD: Picture element for art direction -->
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

<!-- [PASS] GOOD: Modern image formats -->
<picture>
 <source srcset="image.avif" type="image/avif" />
 <source srcset="image.webp" type="image/webp" />
 <img src="image.jpg" alt="Fallback" />
</picture>
```

---

## Forms

```html
<!-- [PASS] GOOD: Accessible form with Tailwind -->
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
<!-- [PASS] GOOD: Resource hints -->
<head>
 <!-- Preconnect to external domains -->
 <link rel="preconnect" href="https://fonts.googleapis.com">
 
 <!-- DNS prefetch -->
 <link rel="dns-prefetch" href="https://api.example.com">
 
 <!-- Preload critical assets -->
 <link rel="preload" href="critical.css" as="style">
 <link rel="preload" href="hero-image.jpg" as="image">
</head>

<!-- [PASS] GOOD: Lazy loading -->
<img src="image.jpg" loading="lazy" alt="Description" />
<iframe src="video.html" loading="lazy"></iframe>

<!-- [PASS] GOOD: Async/defer scripts -->
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
 <button class="text-blue-600 hover:text-blue-800">Read More -></button>
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

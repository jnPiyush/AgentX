# split-html-prototype-template

> Source: [html-prototype-code.md](html-prototype-code.md)
> Source hash (LF-normalized original file): `6B8D0C210F8F1E0D6467AFB0A830DFB0F9437A2CF4F41B019E5D3F4F7F4083C2`
> Relocation manifest:
> - `## HTML Prototype Template` -> original lines 7-199
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

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

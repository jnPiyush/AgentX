// ---------------------------------------------------------------------------
// AgentX -- Codebase Analysis Tools
// ---------------------------------------------------------------------------
//
// Three analysis tools for understanding project structure:
//   - analyze_codebase: file counts, LOC, directory tree, tech detection
//   - find_dependencies: parse package.json, requirements.txt, *.csproj etc.
//   - map_architecture: identify entry points, configs, tests, CI, docs
//
// All tools are read-only (mutating = false) and workspace-sandboxed.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodebaseStats {
  readonly totalFiles: number;
  readonly totalDirectories: number;
  readonly totalLines: number;
  readonly filesByExtension: Record<string, number>;
  readonly technologies: readonly string[];
  readonly tree: string;
}

export interface DependencyInfo {
  readonly manager: string;
  readonly file: string;
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}

export interface ArchitectureMap {
  readonly entryPoints: readonly string[];
  readonly configFiles: readonly string[];
  readonly testDirectories: readonly string[];
  readonly ciFiles: readonly string[];
  readonly docFiles: readonly string[];
  readonly buildOutputs: readonly string[];
  readonly scripts: readonly string[];
}

// ---------------------------------------------------------------------------
// Ignore patterns
// ---------------------------------------------------------------------------

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'out', 'build',
  'bin', 'obj', '.next', '.nuxt', '__pycache__', '.venv', 'venv',
  '.tox', '.mypy_cache', '.pytest_cache', 'coverage', '.nyc_output',
  '.agentx',
]);

const IGNORE_FILES = new Set([
  '.DS_Store', 'Thumbs.db', '.gitkeep',
]);

// ---------------------------------------------------------------------------
// Technology detection
// ---------------------------------------------------------------------------

const TECH_INDICATORS: Record<string, string[]> = {
  'TypeScript': ['.ts', '.tsx'],
  'JavaScript': ['.js', '.jsx', '.mjs', '.cjs'],
  'Python': ['.py', '.pyx', '.pyi'],
  'C#': ['.cs', '.csx'],
  'Java': ['.java'],
  'Go': ['.go'],
  'Rust': ['.rs'],
  'Ruby': ['.rb'],
  'PHP': ['.php'],
  'Swift': ['.swift'],
  'Kotlin': ['.kt', '.kts'],
  'SQL': ['.sql'],
  'HTML': ['.html', '.htm'],
  'CSS': ['.css', '.scss', '.less', '.sass'],
  'Markdown': ['.md', '.mdx'],
  'YAML': ['.yml', '.yaml'],
  'JSON': ['.json'],
  'XML': ['.xml'],
  'Shell': ['.sh', '.bash', '.zsh'],
  'PowerShell': ['.ps1', '.psm1', '.psd1'],
  'Terraform': ['.tf', '.tfvars'],
  'Bicep': ['.bicep'],
  'Docker': ['Dockerfile'],
  'Razor': ['.razor', '.cshtml'],
};

// ---------------------------------------------------------------------------
// Architecture detection patterns
// ---------------------------------------------------------------------------

const ENTRY_POINT_PATTERNS = [
  'index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js',
  'server.ts', 'server.js', 'Program.cs', 'Startup.cs', 'main.py',
  'app.py', 'manage.py', 'main.go', 'main.rs', 'extension.ts',
];

const CONFIG_PATTERNS = [
  'tsconfig.json', 'package.json', '.eslintrc*', '.prettierrc*',
  'jest.config.*', 'vitest.config.*', 'webpack.config.*', 'vite.config.*',
  'rollup.config.*', '.babelrc', 'babel.config.*', 'pyproject.toml',
  'setup.py', 'setup.cfg', 'requirements.txt', 'Pipfile', 'Cargo.toml',
  'go.mod', 'Gemfile', 'composer.json', '*.csproj', '*.sln',
  '.editorconfig', '.gitignore', '.dockerignore', 'Makefile',
];

const CI_PATTERNS = [
  '.github/workflows/*.yml', '.github/workflows/*.yaml',
  '.gitlab-ci.yml', 'Jenkinsfile', 'azure-pipelines.yml',
  '.circleci/config.yml', '.travis.yml', 'appveyor.yml',
  'bitbucket-pipelines.yml',
];

const DOC_PATTERNS = [
  'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE',
  'docs/', 'doc/', 'wiki/',
];

const BUILD_OUTPUT_DIRS = ['dist', 'out', 'build', 'bin', 'obj', '.next', 'target'];

const SCRIPT_PATTERNS = ['scripts/', 'tools/', 'bin/'];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function walkDirectory(
  dirPath: string,
  depth: number,
  maxDepth: number,
): { files: string[]; dirs: string[]; tree: string[] } {
  const files: string[] = [];
  const dirs: string[] = [];
  const tree: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return { files, dirs, tree };
  }

  // Sort: directories first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) { return -1; }
    if (!a.isDirectory() && b.isDirectory()) { return 1; }
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name) || IGNORE_FILES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const indent = '  '.repeat(depth);

    if (entry.isDirectory()) {
      dirs.push(fullPath);
      tree.push(`${indent}${entry.name}/`);

      if (depth < maxDepth) {
        const sub = walkDirectory(fullPath, depth + 1, maxDepth);
        files.push(...sub.files);
        dirs.push(...sub.dirs);
        tree.push(...sub.tree);
      }
    } else if (entry.isFile()) {
      files.push(fullPath);
      tree.push(`${indent}${entry.name}`);
    }
  }

  return { files, dirs, tree };
}

function matchesGlob(filePath: string, pattern: string): boolean {
  // Simple glob matching: supports * and **
  const normalized = filePath.replace(/\\/g, '/');
  const patternNorm = pattern.replace(/\\/g, '/');

  if (patternNorm.includes('*')) {
    const regex = new RegExp(
      '^' + patternNorm
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '___GLOBSTAR___')
        .replace(/\*/g, '[^/]*')
        .replace(/___GLOBSTAR___/g, '.*')
      + '$',
    );
    return regex.test(normalized);
  }

  // Exact match or ends-with check
  return normalized === patternNorm || normalized.endsWith('/' + patternNorm) || normalized.endsWith(patternNorm);
}

// ---------------------------------------------------------------------------
// Public API: analyze_codebase
// ---------------------------------------------------------------------------

/**
 * Analyze a workspace directory for file counts, LOC, technology detection,
 * and directory structure.
 *
 * @param workspaceRoot - Absolute path to the workspace root
 * @param maxDepth - Maximum directory depth for the tree (default 4)
 * @returns Codebase statistics
 */
export function analyzeCo(workspaceRoot: string, maxDepth: number = 4): CodebaseStats {
  if (!fs.existsSync(workspaceRoot)) {
    return {
      totalFiles: 0,
      totalDirectories: 0,
      totalLines: 0,
      filesByExtension: {},
      technologies: [],
      tree: '(directory not found)',
    };
  }

  const { files, dirs, tree } = walkDirectory(workspaceRoot, 0, maxDepth);
  const filesByExtension: Record<string, number> = {};
  let totalLines = 0;
  const detectedTechs = new Set<string>();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const basename = path.basename(file);

    // Count by extension
    if (ext) {
      filesByExtension[ext] = (filesByExtension[ext] ?? 0) + 1;
    } else {
      filesByExtension['(no ext)'] = (filesByExtension['(no ext)'] ?? 0) + 1;
    }

    // Count lines for text files
    if (['.ts', '.js', '.py', '.cs', '.java', '.go', '.rs', '.rb', '.php',
         '.html', '.css', '.scss', '.md', '.yml', '.yaml', '.json', '.xml',
         '.sh', '.ps1', '.sql', '.tf', '.bicep', '.razor', '.tsx', '.jsx',
         '.mjs', '.cjs', '.pyx', '.pyi'].includes(ext)) {
      totalLines += countLines(file);
    }

    // Detect technologies
    for (const [tech, indicators] of Object.entries(TECH_INDICATORS)) {
      if (indicators.includes(ext) || indicators.includes(basename)) {
        detectedTechs.add(tech);
      }
    }
  }

  return {
    totalFiles: files.length,
    totalDirectories: dirs.length,
    totalLines,
    filesByExtension,
    technologies: [...detectedTechs].sort(),
    tree: tree.join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Public API: find_dependencies
// ---------------------------------------------------------------------------

/**
 * Detect package managers and parse dependency files.
 *
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns Array of dependency info objects (one per detected manager)
 */
export function findDependencies(workspaceRoot: string): DependencyInfo[] {
  const results: DependencyInfo[] = [];

  // package.json (npm / pnpm / yarn / bun)
  const packageJson = path.join(workspaceRoot, 'package.json');
  if (fs.existsSync(packageJson)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
      results.push({
        manager: 'npm',
        file: 'package.json',
        dependencies: pkg.dependencies ?? {},
        devDependencies: pkg.devDependencies ?? {},
      });
    } catch { /* invalid JSON */ }
  }

  // requirements.txt (pip)
  const reqTxt = path.join(workspaceRoot, 'requirements.txt');
  if (fs.existsSync(reqTxt)) {
    try {
      const lines = fs.readFileSync(reqTxt, 'utf-8').split('\n');
      const deps: Record<string, string> = {};
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*([>=<~!].*)?$/);
          if (match) {
            deps[match[1]] = match[2] ?? '*';
          }
        }
      }
      results.push({
        manager: 'pip',
        file: 'requirements.txt',
        dependencies: deps,
        devDependencies: {},
      });
    } catch { /* read error */ }
  }

  // pyproject.toml (basic parsing for [project] dependencies)
  const pyproject = path.join(workspaceRoot, 'pyproject.toml');
  if (fs.existsSync(pyproject)) {
    try {
      const content = fs.readFileSync(pyproject, 'utf-8');
      const depsMatch = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/);
      if (depsMatch) {
        const deps: Record<string, string> = {};
        const depLines = depsMatch[1].split('\n');
        for (const line of depLines) {
          const cleaned = line.replace(/[",]/g, '').trim();
          if (cleaned) {
            const parts = cleaned.split(/[>=<~!]/);
            deps[parts[0].trim()] = cleaned.slice(parts[0].length).trim() || '*';
          }
        }
        results.push({
          manager: 'pip (pyproject.toml)',
          file: 'pyproject.toml',
          dependencies: deps,
          devDependencies: {},
        });
      }
    } catch { /* parse error */ }
  }

  // *.csproj (NuGet)
  const csprojFiles = findFilesWithExtension(workspaceRoot, '.csproj', 2);
  for (const csproj of csprojFiles) {
    try {
      const content = fs.readFileSync(csproj, 'utf-8');
      const deps: Record<string, string> = {};
      const pkgRefs = content.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g);
      for (const match of pkgRefs) {
        deps[match[1]] = match[2];
      }
      if (Object.keys(deps).length > 0) {
        results.push({
          manager: 'nuget',
          file: path.relative(workspaceRoot, csproj).replace(/\\/g, '/'),
          dependencies: deps,
          devDependencies: {},
        });
      }
    } catch { /* parse error */ }
  }

  // go.mod
  const goMod = path.join(workspaceRoot, 'go.mod');
  if (fs.existsSync(goMod)) {
    try {
      const content = fs.readFileSync(goMod, 'utf-8');
      const deps: Record<string, string> = {};
      const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/);
      if (requireBlock) {
        const lines = requireBlock[1].split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2 && !parts[0].startsWith('//')) {
            deps[parts[0]] = parts[1];
          }
        }
      }
      results.push({
        manager: 'go',
        file: 'go.mod',
        dependencies: deps,
        devDependencies: {},
      });
    } catch { /* parse error */ }
  }

  // Cargo.toml (Rust)
  const cargoToml = path.join(workspaceRoot, 'Cargo.toml');
  if (fs.existsSync(cargoToml)) {
    try {
      const content = fs.readFileSync(cargoToml, 'utf-8');
      const deps: Record<string, string> = {};
      const devDeps: Record<string, string> = {};
      const depsSection = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
      if (depsSection) {
        for (const line of depsSection[1].split('\n')) {
          const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"?([^"\n]+)"?/);
          if (match) { deps[match[1]] = match[2].trim(); }
        }
      }
      const devSection = content.match(/\[dev-dependencies\]([\s\S]*?)(?=\[|$)/);
      if (devSection) {
        for (const line of devSection[1].split('\n')) {
          const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"?([^"\n]+)"?/);
          if (match) { devDeps[match[1]] = match[2].trim(); }
        }
      }
      results.push({
        manager: 'cargo',
        file: 'Cargo.toml',
        dependencies: deps,
        devDependencies: devDeps,
      });
    } catch { /* parse error */ }
  }

  return results;
}

function findFilesWithExtension(dir: string, ext: string, maxDepth: number, depth: number = 0): string[] {
  const results: string[] = [];
  if (depth > maxDepth) { return results; }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) { continue; }
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    } else if (entry.isDirectory()) {
      results.push(...findFilesWithExtension(full, ext, maxDepth, depth + 1));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API: map_architecture
// ---------------------------------------------------------------------------

/**
 * Map the architecture of a workspace by identifying entry points,
 * configs, test directories, CI files, documentation, and build outputs.
 *
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns Architecture map
 */
export function mapArchitecture(workspaceRoot: string): ArchitectureMap {
  const entryPoints: string[] = [];
  const configFiles: string[] = [];
  const testDirectories: string[] = [];
  const ciFiles: string[] = [];
  const docFiles: string[] = [];
  const buildOutputs: string[] = [];
  const scripts: string[] = [];

  const { files, dirs } = walkDirectory(workspaceRoot, 0, 5);

  for (const file of files) {
    const relative = path.relative(workspaceRoot, file).replace(/\\/g, '/');
    const basename = path.basename(file);

    // Entry points
    if (ENTRY_POINT_PATTERNS.includes(basename)) {
      entryPoints.push(relative);
    }

    // Config files
    for (const pattern of CONFIG_PATTERNS) {
      if (matchesGlob(relative, pattern) || matchesGlob(basename, pattern)) {
        configFiles.push(relative);
        break;
      }
    }

    // CI files
    for (const pattern of CI_PATTERNS) {
      if (matchesGlob(relative, pattern)) {
        ciFiles.push(relative);
        break;
      }
    }

    // Doc files
    for (const pattern of DOC_PATTERNS) {
      if (matchesGlob(relative, pattern) || matchesGlob(basename, pattern)) {
        docFiles.push(relative);
        break;
      }
    }
  }

  for (const dir of dirs) {
    const relative = path.relative(workspaceRoot, dir).replace(/\\/g, '/');
    const basename = path.basename(dir);

    // Test directories
    if (['test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'integration'].includes(basename)) {
      testDirectories.push(relative);
    }

    // Build outputs
    if (BUILD_OUTPUT_DIRS.includes(basename)) {
      buildOutputs.push(relative);
    }

    // Scripts
    for (const pattern of SCRIPT_PATTERNS) {
      if (matchesGlob(relative + '/', pattern)) {
        scripts.push(relative);
        break;
      }
    }
  }

  return {
    entryPoints: [...new Set(entryPoints)].sort(),
    configFiles: [...new Set(configFiles)].sort(),
    testDirectories: [...new Set(testDirectories)].sort(),
    ciFiles: [...new Set(ciFiles)].sort(),
    docFiles: [...new Set(docFiles)].sort(),
    buildOutputs: [...new Set(buildOutputs)].sort(),
    scripts: [...new Set(scripts)].sort(),
  };
}

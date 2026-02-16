#!/usr/bin/env python3
"""Scaffold Playwright end-to-end tests for a web application.

Generates:
 - Playwright config (playwright.config.ts or conftest.py)
 - Page Object Model (POM) base classes
 - Sample e2e test files
 - GitHub Actions workflow for Playwright CI

Usage:
 python scaffold-playwright.py [--lang python|typescript] [--url http://localhost:3000] [--output ./e2e]

Supports: TypeScript (npm) and Python (pytest-playwright)
"""

import argparse
import os
import sys
from pathlib import Path

# ----------------------------------------------------------
# TypeScript templates
# ----------------------------------------------------------

TS_PLAYWRIGHT_CONFIG = """\
import {{ defineConfig, devices }} from "@playwright/test";

export default defineConfig({{
 testDir: "./tests",
 fullyParallel: true,
 forbidOnly: !!process.env.CI,
 retries: process.env.CI ? 2 : 0,
 workers: process.env.CI ? 1 : undefined,
 reporter: [
 ["html", {{ open: "never" }}],
 ["list"],
 ],
 use: {{
 baseURL: "{base_url}",
 trace: "on-first-retry",
 screenshot: "only-on-failure",
 video: "retain-on-failure",
 }},
 projects: [
 {{ name: "chromium", use: {{ ...devices["Desktop Chrome"] }} }},
 {{ name: "firefox", use: {{ ...devices["Desktop Firefox"] }} }},
 {{ name: "webkit", use: {{ ...devices["Desktop Safari"] }} }},
 {{ name: "mobile-chrome", use: {{ ...devices["Pixel 5"] }} }},
 ],
 webServer: {{
 command: "npm run dev",
 url: "{base_url}",
 reuseExistingServer: !process.env.CI,
 timeout: 120_000,
 }},
}});
"""

TS_PAGE_BASE = """\
import {{ type Page, type Locator }} from "@playwright/test";

/**
 * Base Page Object Model - all page objects extend this.
 */
export abstract class BasePage {{
 constructor(protected readonly page: Page) {{}}

 async goto(path: string): Promise<void> {{
 await this.page.goto(path);
 }}

 async getTitle(): Promise<string> {{
 return this.page.title();
 }}

 async waitForLoad(): Promise<void> {{
 await this.page.waitForLoadState("networkidle");
 }}
}}
"""

TS_HOME_PAGE = """\
import {{ type Page, type Locator }} from "@playwright/test";
import {{ BasePage }} from "./base.page";

export class HomePage extends BasePage {{
 // --- Locators ---
 readonly heading: Locator;
 readonly navLinks: Locator;

 constructor(page: Page) {{
 super(page);
 this.heading = page.locator("h1").first();
 this.navLinks = page.locator("nav a");
 }}

 async navigate(): Promise<void> {{
 await this.goto("/");
 await this.waitForLoad();
 }}

 async getHeadingText(): Promise<string> {{
 return (await this.heading.textContent()) ?? "";
 }}
}}
"""

TS_SAMPLE_TEST = """\
import {{ test, expect }} from "@playwright/test";
import {{ HomePage }} from "../pages/home.page";

test.describe("Home Page", () => {{
 let homePage: HomePage;

 test.beforeEach(async ({{ page }}) => {{
 homePage = new HomePage(page);
 await homePage.navigate();
 }});

 test("should display the heading", async () => {{
 const heading = await homePage.getHeadingText();
 expect(heading).toBeTruthy();
 }});

 test("should have a valid title", async ({{ page }}) => {{
 await expect(page).toHaveTitle(/.+/);
 }});

 test("should be responsive", async ({{ page }}) => {{
 // Test mobile viewport
 await page.setViewportSize({{ width: 375, height: 667 }});
 await expect(page.locator("body")).toBeVisible();
 }});

 test("should have no accessibility violations", async ({{ page }}) => {{
 // Basic a11y: all images should have alt text
 const images = page.locator("img");
 const count = await images.count();
 for (let i = 0; i < count; i++) {{
 await expect(images.nth(i)).toHaveAttribute("alt", /.*/);
 }}
 }});
}});
"""

TS_PACKAGE_ADDITIONS = """\
{{
 "devDependencies": {{
 "@playwright/test": "^1.50.0"
 }},
 "scripts": {{
 "test:e2e": "playwright test",
 "test:e2e:ui": "playwright test --ui",
 "test:e2e:headed": "playwright test --headed",
 "test:e2e:report": "playwright show-report"
 }}
}}
"""

# ----------------------------------------------------------
# Python templates
# ----------------------------------------------------------

PY_CONFTEST = """\
\"\"\"Playwright pytest configuration and fixtures.\"\"\"
import pytest
from playwright.sync_api import Page

@pytest.fixture(scope="session")
def base_url() -> str:
 \"\"\"Base URL for the application under test.\"\"\"
 return "{base_url}"

@pytest.fixture
def home_page(page: Page, base_url: str) -> Page:
 \"\"\"Navigate to the home page before each test.\"\"\"
 page.goto(base_url)
 page.wait_for_load_state("networkidle")
 return page
"""

PY_BASE_PAGE = """\
\"\"\"Base Page Object Model for Playwright tests.\"\"\"
from playwright.sync_api import Page, Locator

class BasePage:
 \"\"\"Base class for all page objects.\"\"\"

 def __init__(self, page: Page, base_url: str = "") -> None:
 self.page = page
 self.base_url = base_url

 def goto(self, path: str = "/") -> None:
 \"\"\"Navigate to a path relative to base_url.\"\"\"
 self.page.goto(f"{{self.base_url}}{{path}}")

 def get_title(self) -> str:
 \"\"\"Get the page title.\"\"\"
 return self.page.title()

 def wait_for_load(self) -> None:
 \"\"\"Wait for the page to finish loading.\"\"\"
 self.page.wait_for_load_state("networkidle")
"""

PY_HOME_PAGE = """\
\"\"\"Home page object model.\"\"\"
from playwright.sync_api import Page, Locator
from .base_page import BasePage

class HomePage(BasePage):
 \"\"\"Page object for the home page.\"\"\"

 def __init__(self, page: Page, base_url: str = "") -> None:
 super().__init__(page, base_url)
 self.heading: Locator = page.locator("h1").first
 self.nav_links: Locator = page.locator("nav a")

 def navigate(self) -> None:
 \"\"\"Go to the home page.\"\"\"
 self.goto("/")
 self.wait_for_load()

 def get_heading_text(self) -> str:
 \"\"\"Return the heading text.\"\"\"
 return self.heading.text_content() or ""
"""

PY_SAMPLE_TEST = """\
\"\"\"End-to-end tests for the home page.\"\"\"
import pytest
from playwright.sync_api import Page, expect

from pages.home_page import HomePage

class TestHomePage:
 \"\"\"Home page e2e tests.\"\"\"

 def test_should_display_heading(self, home_page: Page, base_url: str) -> None:
 page_obj = HomePage(home_page, base_url)
 page_obj.navigate()
 assert page_obj.get_heading_text()

 def test_should_have_valid_title(self, home_page: Page) -> None:
 expect(home_page).to_have_title(r".+")

 def test_should_be_responsive(self, home_page: Page) -> None:
 home_page.set_viewport_size({{"width": 375, "height": 667}})
 expect(home_page.locator("body")).to_be_visible()

 def test_images_have_alt_text(self, home_page: Page) -> None:
 images = home_page.locator("img")
 for i in range(images.count()):
 expect(images.nth(i)).to_have_attribute("alt", r".*")
"""

PY_REQUIREMENTS = """\
pytest>=8.0.0
pytest-playwright>=0.5.0
playwright>=1.50.0
"""

# ----------------------------------------------------------
# GitHub Actions CI template
# ----------------------------------------------------------

GH_ACTIONS_WORKFLOW = """\
name: Playwright E2E Tests

on:
 push:
 branches: [main, master]
 pull_request:
 branches: [main, master]

jobs:
 e2e:
 runs-on: ubuntu-latest
 timeout-minutes: 30

 steps:
 - uses: actions/checkout@v4

 - name: Setup Node.js
 if: ${{{{ inputs.lang == 'typescript' || '{lang}' == 'typescript' }}}}
 uses: actions/setup-node@v4
 with:
 node-version: 20
 cache: npm

 - name: Setup Python
 if: ${{{{ inputs.lang == 'python' || '{lang}' == 'python' }}}}
 uses: actions/setup-python@v5
 with:
 python-version: "3.12"

 - name: Install dependencies ({lang})
 run: |
{install_cmd}

 - name: Install Playwright browsers
 run: {browser_cmd}

 - name: Run Playwright tests
 run: {test_cmd}

 - name: Upload test results
 uses: actions/upload-artifact@v4
 if: always()
 with:
 name: playwright-report
 path: |
 {report_path}
 retention-days: 30
"""

def create_typescript_scaffold(output_dir: Path, base_url: str) -> list[str]:
 """Generate TypeScript Playwright scaffold files."""
 files: list[str] = []

 # Config
 config = output_dir / "playwright.config.ts"
 config.write_text(TS_PLAYWRIGHT_CONFIG.format(base_url=base_url))
 files.append(str(config))

 # Pages (POM)
 pages_dir = output_dir / "pages"
 pages_dir.mkdir(parents=True, exist_ok=True)

 (pages_dir / "base.page.ts").write_text(TS_PAGE_BASE)
 files.append(str(pages_dir / "base.page.ts"))

 (pages_dir / "home.page.ts").write_text(TS_HOME_PAGE)
 files.append(str(pages_dir / "home.page.ts"))

 # Tests
 tests_dir = output_dir / "tests"
 tests_dir.mkdir(parents=True, exist_ok=True)

 (tests_dir / "home.spec.ts").write_text(TS_SAMPLE_TEST)
 files.append(str(tests_dir / "home.spec.ts"))

 # Reference: package.json additions
 pkg_ref = output_dir / "package-additions.json"
 pkg_ref.write_text(TS_PACKAGE_ADDITIONS)
 files.append(str(pkg_ref))

 return files

def create_python_scaffold(output_dir: Path, base_url: str) -> list[str]:
 """Generate Python Playwright scaffold files."""
 files: list[str] = []

 # conftest.py
 conftest = output_dir / "conftest.py"
 conftest.write_text(PY_CONFTEST.format(base_url=base_url))
 files.append(str(conftest))

 # Pages (POM)
 pages_dir = output_dir / "pages"
 pages_dir.mkdir(parents=True, exist_ok=True)

 (pages_dir / "__init__.py").write_text("")
 (pages_dir / "base_page.py").write_text(PY_BASE_PAGE)
 files.append(str(pages_dir / "base_page.py"))

 (pages_dir / "home_page.py").write_text(PY_HOME_PAGE)
 files.append(str(pages_dir / "home_page.py"))

 # Tests
 tests_dir = output_dir / "tests"
 tests_dir.mkdir(parents=True, exist_ok=True)

 (tests_dir / "__init__.py").write_text("")
 (tests_dir / "test_home.py").write_text(PY_SAMPLE_TEST)
 files.append(str(tests_dir / "test_home.py"))

 # requirements
 req = output_dir / "requirements-e2e.txt"
 req.write_text(PY_REQUIREMENTS)
 files.append(str(req))

 return files

def create_ci_workflow(output_dir: Path, lang: str) -> str:
 """Generate GitHub Actions workflow."""
 ci_dir = output_dir / ".github" / "workflows"
 ci_dir.mkdir(parents=True, exist_ok=True)
 ci_file = ci_dir / "playwright.yml"

 if lang == "typescript":
 install_cmd = " npm ci"
 browser_cmd = "npx playwright install --with-deps"
 test_cmd = "npx playwright test"
 report_path = "playwright-report/"
 else:
 install_cmd = " pip install -r requirements-e2e.txt"
 browser_cmd = "python -m playwright install --with-deps"
 test_cmd = "python -m pytest --browser chromium --browser firefox"
 report_path = "test-results/"

 ci_file.write_text(GH_ACTIONS_WORKFLOW.format(
 lang=lang,
 install_cmd=install_cmd,
 browser_cmd=browser_cmd,
 test_cmd=test_cmd,
 report_path=report_path,
 ))
 return str(ci_file)

def main() -> None:
 parser = argparse.ArgumentParser(
 description="Scaffold Playwright end-to-end tests"
 )
 parser.add_argument(
 "--lang",
 choices=["typescript", "python"],
 default="typescript",
 help="Language/framework (default: typescript)",
 )
 parser.add_argument(
 "--url",
 default="http://localhost:3000",
 help="Base URL of the app under test (default: http://localhost:3000)",
 )
 parser.add_argument(
 "--output",
 default="./e2e",
 help="Output directory (default: ./e2e)",
 )
 parser.add_argument(
 "--ci",
 action="store_true",
 help="Also generate GitHub Actions CI workflow",
 )

 args = parser.parse_args()
 output_dir = Path(args.output).resolve()
 output_dir.mkdir(parents=True, exist_ok=True)

 print(f"Scaffolding Playwright ({args.lang}) tests...")
 print(f" Base URL: {args.url}")
 print(f" Output: {output_dir}")

 if args.lang == "typescript":
 files = create_typescript_scaffold(output_dir, args.url)
 else:
 files = create_python_scaffold(output_dir, args.url)

 if args.ci:
 ci_file = create_ci_workflow(output_dir, args.lang)
 files.append(ci_file)

 print(f"\nCreated {len(files)} files:")
 for f in files:
 print(f" - {os.path.relpath(f, start=os.getcwd())}")

 print(f"\nNext steps:")
 if args.lang == "typescript":
 print(" 1. npm install @playwright/test")
 print(" 2. npx playwright install")
 print(" 3. npx playwright test")
 else:
 print(" 1. pip install pytest-playwright playwright")
 print(" 2. python -m playwright install")
 print(" 3. python -m pytest e2e/")

if __name__ == "__main__":
 main()

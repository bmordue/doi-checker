# DOI Checker - GitHub Copilot Instructions

DOI Checker is a serverless Cloudflare Worker application for monitoring DOI links and posting status updates to ActivityPub.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Build
- **Install dependencies:** `npm install` -- takes ~5 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- **Build the project:** `npm run build` -- takes ~500ms. Creates `terraform/dist/worker.js`.
- **Run tests:** `npm test` -- takes ~2 seconds. NEVER CANCEL. Set timeout to 30+ seconds. Runs 76 tests.
- **Run mutation tests:** `npx stryker run` -- takes 65 seconds. NEVER CANCEL. Set timeout to 120+ seconds.

### Development
- **Local development server:** `npm run dev` -- starts Wrangler dev server on http://localhost:8787. Takes ~10 seconds to start.
- **Watch mode testing:** `npm run test:watch` -- runs tests in watch mode with hot reloading.

### Important Build Notes
- **NEVER CANCEL any build or test command** - all builds complete within 2 minutes
- Build creates output in `terraform/dist/worker.js` (54KB file)
- Tests include both unit tests (`tests/unit/`) and integration tests (`tests/integration/`)
- No linting scripts are configured in this project

## Validation Scenarios

### ALWAYS Test These Complete End-to-End Scenarios After Making Changes:

1. **API Functionality Test:**
   ```bash
   # Start dev server
   npm run dev
   # In another terminal, test API endpoints:
   curl -X POST -H "Content-Type: application/json" -d '{"dois": ["10.1000/test123"]}' "http://localhost:8787/add-doi"
   curl "http://localhost:8787/status"
   curl -X POST "http://localhost:8787/check"
   ```
   - Expected: All endpoints return valid JSON responses
   - Expected: Status page loads with HTML interface
   - Expected: DOI persists between API calls (shows in status after adding)

2. **Build and Test Validation:**
   ```bash
   npm install
   npm run build
   npm test
   ```
   - Expected: Build succeeds, all 76 tests pass
   - Expected: `terraform/dist/worker.js` file created (~54KB)

3. **Code Quality Validation:**
   ```bash
   npx stryker run
   ```
   - Expected: Mutation testing completes successfully in ~65 seconds
   - Expected: Generates HTML report in `reports/mutation/`

## Project Architecture

### Key Components
- **`src/worker.js`** - Main Cloudflare Worker entry point
- **`src/lib/`** - Core libraries:
  - `doi-validator.js` - DOI format validation
  - `checker.js` - DOI link checking logic
  - `activitypub.js` - ActivityPub notifications
  - `logger.js` - Structured logging
  - `errors.js` - Error handling
- **`tests/`** - Test suites (unit and integration)
- **`terraform/`** - Infrastructure as code
- **`docs/`** - API and deployment documentation

### Data Flow
1. DOIs added via `/add-doi` endpoint or scripts
2. Scheduled checks run via cron triggers
3. Status tracked in Cloudflare KV storage
4. Broken DOIs trigger ActivityPub notifications

## Configuration Requirements

### For Local Development
- **No additional configuration needed** for basic development
- `wrangler.toml` configured with test KV namespaces
- Local server runs without external dependencies

### For Deployment (Terraform)
- Copy `terraform/terraform.tfvars.example` to `terraform/terraform.tfvars`
- Requires Cloudflare account ID and API token
- Requires Terraform CLI (not available in sandbox environments)
- Deploy with: `./scripts/deploy.sh`

## Common Tasks and Expected Outputs

### Repository Root Contents
```
.git/                    - Git repository
.github/                 - GitHub workflows and configs
CLAUDE.md               - Claude-specific documentation
LICENSE                 - MIT license
README.md               - Project overview
docs/                   - Documentation (API.md, DEPLOYMENT.md, etc.)
package.json            - NPM dependencies and scripts
rollup.config.js        - Build configuration
scripts/                - Utility scripts (deploy.sh)
shell.nix               - Nix development environment
src/                    - Source code
stryker.config.json     - Mutation testing config
terraform/              - Infrastructure code
tests/                  - Test suites
vitest.config.js        - Test configuration
wrangler.toml           - Cloudflare Worker config
```

### Package.json Scripts
```json
{
  "build": "rollup -c",
  "test": "vitest run", 
  "test:watch": "vitest",
  "deploy": "./scripts/deploy.sh",
  "dev": "wrangler dev src/worker.js"
}
```

### Test Structure
- **Unit tests:** `tests/unit/` - Test individual components
- **Integration tests:** `tests/integration/` - Test worker endpoints
- **Test fixtures:** `tests/fixtures/` - Shared test data
- **Setup:** `tests/setup-vitest.js` - Test environment configuration

## Critical Warnings

### Timing Expectations
- **npm install:** 10 seconds max - NEVER CANCEL
- **npm test:** 5 seconds max - NEVER CANCEL  
- **npm run build:** 1 second max
- **npx stryker run:** 70 seconds max - NEVER CANCEL
- **npm run dev:** 10 seconds to start

### Known Limitations
- **Terraform not available** in sandbox environments
- **Empty script files:** `scripts/add-sample-dois.sh` and `scripts/test-endpoints.sh` exist but are empty
- **No linting configured** - no eslint or prettier scripts available
- **Deployment requires external setup** - Cloudflare credentials needed

### Always Run Before Committing
```bash
npm test                 # Ensure all tests pass
npm run build           # Ensure build succeeds
npx stryker run         # Run mutation testing (optional but recommended)
```

## Troubleshooting

### Common Issues
- **Build fails:** Check that `npm install` completed successfully
- **Tests fail:** Ensure no syntax errors in source code
- **Dev server won't start:** Check that port 8787 is available
- **KV namespace errors:** In development, these are mocked and can be ignored

### File Locations for Quick Reference
- **Main worker code:** `src/worker.js`
- **API endpoints defined in:** `src/worker.js` (lines handling POST/GET requests)
- **Test files:** `tests/unit/*.test.js` and `tests/integration/*.test.js`
- **Build output:** `terraform/dist/worker.js`
- **Configuration:** `wrangler.toml`, `terraform/terraform.tfvars.example`
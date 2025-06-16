# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint and Test Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Local development (runs a local development server)
npm run dev

# Deploy to Cloudflare
npm run deploy
# OR
./scripts/deploy.sh

# Add sample DOIs for testing
./scripts/add-sample-dois.sh

# Test API endpoints
./scripts/test-endpoints.sh
```

## Project Architecture

DOI Checker is a serverless tool for monitoring DOI links and posting status updates to ActivityPub.

### Key Components:

1. **Worker (src/worker.js)**
   - The main Cloudflare Worker script that handles API endpoints and scheduled checks
   - Provides endpoints for adding/removing DOIs and checking DOI status
   - Implements a cron trigger for regular DOI checks

2. **DOI Validator (src/lib/doi-validator.js)**
   - Validates DOI format and structure
   - Performs basic format checks before adding DOIs to the monitoring list

3. **Checker (src/lib/checker.js)**
   - Handles the logic for checking DOI links
   - Makes HTTP requests to DOIs and determines if they are working
   - Tracks DOI status over time

4. **ActivityPub Integration (src/lib/activitypub.js)**
   - Handles posting updates to an ActivityPub server (snac2)
   - Formats messages about broken DOIs for notification

5. **Cloudflare KV Storage**
   - Two KV namespaces: `DOIS` (list of DOIs to monitor) and `STATUS` (status history)
   - Used for persistent storage of DOI lists and check results

6. **Terraform Configuration**
   - Provisions Cloudflare Workers, KV namespaces, and cron triggers
   - Managed through files in the `terraform/` directory
   - Configuration handled through `terraform.tfvars` (copied from example)

### Data Flow:

1. DOIs are added to the monitoring list via API or scripts
2. The worker runs checks on a scheduled basis (default: daily at 9 AM UTC)
3. Each DOI is checked for accessibility
4. If a DOI becomes broken (was working before, now failing), an ActivityPub notification is sent
5. The current status of all DOIs is available via the status endpoint

## Configuration

The project requires configuration in two main places:

1. **Terraform Variables (`terraform/terraform.tfvars`)**
   - Copy from `terraform.tfvars.example` and customize
   - Required: Cloudflare account ID
   - Required for ActivityPub: snac2 server URL and authentication
   - Optional: Custom domain, check frequency, retry settings

2. **Environment Variables for Local Development**
   - CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY for Terraform
   - The local development environment uses wrangler (Cloudflare's CLI)

## Deployment Process

1. Configure Terraform variables in `terraform/terraform.tfvars`
2. Run `npm run deploy` or `./scripts/deploy.sh`
3. The script will:
   - Bundle the worker code
   - Apply Terraform configuration
   - Deploy to Cloudflare
   - Set up KV namespaces and cron triggers

## Testing

The project uses Vitest for testing:

- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Test fixtures in `tests/fixtures/`

## Project Status

Refer to `docs/ROADMAP.md` for the current project status and upcoming features.
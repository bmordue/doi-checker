# DOI Checker

A serverless tool for monitoring DOI links and posting status updates to ActivityPub.

## Quick Start

1. **Setup project dependencies:**
   ```bash
   npm install
   ```

2. **Configure Terraform:**
   ```bash
   cp terraform/terraform.tfvars.example terraform/terraform.tfvars
   # Edit terraform.tfvars with your Cloudflare details
   ```

3. **Deploy infrastructure:**
   ```bash
   ./scripts/deploy.sh
   ```

4. **Add DOIs to monitor:**
   ```bash
   ./scripts/add-sample-dois.sh
   ```

## Documentation

- [📋 Project Roadmap](docs/ROADMAP.md) - Detailed development roadmap with phases, timelines, and success metrics
- [📡 API Documentation](docs/API.md) - Complete API reference and usage examples
- [🚀 Deployment Guide](docs/DEPLOYMENT.md) - Step-by-step deployment instructions
- [⚙️ Configuration Options](docs/CONFIGURATION.md) - All configuration variables and settings

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Local development
npm run dev
```

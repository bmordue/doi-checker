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

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Configuration Options](docs/CONFIGURATION.md)

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Local development
npm run dev
```

## Browser Extension

This repository includes a starter template for a Chrome browser extension located in the `browser-extension` directory.

**Purpose:** This extension is intended to provide easy access to the features of the DOI Checker directly from your browser. (Functionality to be developed).

**How to Load the Extension in Chrome (for development):**

1.  Open Google Chrome.
2.  Navigate to `chrome://extensions`.
3.  Enable "Developer mode" using the toggle switch in the top-right corner.
4.  Click the "Load unpacked" button that appears.
5.  Select the `browser-extension` directory from this repository.
6.  The extension should now be loaded and visible in your Chrome extensions list and toolbar.

You will need to replace the placeholder icons in `browser-extension/icons/` with actual `.png` image files for the extension to display correctly.

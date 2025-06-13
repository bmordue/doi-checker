terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# Configure the Cloudflare Provider
provider "cloudflare" {
  # You'll need to set these environment variables:
  # CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY
}

# Get your account ID
data "cloudflare_accounts" "main" {
  name = "your-account-name" # Replace with your actual account name
}

# Create KV namespace for DOIs
resource "cloudflare_workers_kv_namespace" "dois" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  title      = "doi-checker-dois"
}

# Create KV namespace for status
resource "cloudflare_workers_kv_namespace" "status" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  title      = "doi-checker-status"
}

# Create the Worker script
resource "cloudflare_worker_script" "doi_checker" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  name       = "doi-checker"
  content    = file("${path.module}/worker.js")

  # Bind KV namespaces to the worker
  kv_namespace_binding {
    name         = "DOIS"
    namespace_id = cloudflare_workers_kv_namespace.dois.id
  }

  kv_namespace_binding {
    name         = "STATUS"
    namespace_id = cloudflare_workers_kv_namespace.status.id
  }

  # Optional: Add environment variables for snac2 configuration
  # plain_text_binding {
  #   name = "SNAC2_SERVER_URL"
  #   text = "https://your-snac2-server.com"
  # }
  # 
  # secret_text_binding {
  #   name = "SNAC2_TOKEN"
  #   text = "your-api-token"
  # }
}

# Create a custom domain route (optional)
# resource "cloudflare_worker_route" "doi_checker" {
#   zone_id     = "your-zone-id"
#   pattern     = "doi-checker.yourdomain.com/*"
#   script_name = cloudflare_worker_script.doi_checker.name
# }

# Create cron trigger for scheduled checks
resource "cloudflare_worker_cron_trigger" "daily_check" {
  account_id  = data.cloudflare_accounts.main.accounts[0].id
  script_name = cloudflare_worker_script.doi_checker.name
  cron        = "0 9 * * *" # Daily at 9 AM UTC
}

# Outputs
output "worker_url" {
  value = "https://${cloudflare_worker_script.doi_checker.name}.${data.cloudflare_accounts.main.accounts[0].id}.workers.dev"
}

output "kv_namespace_ids" {
  value = {
    dois   = cloudflare_workers_kv_namespace.dois.id
    status = cloudflare_workers_kv_namespace.status.id
  }
}
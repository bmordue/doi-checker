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
  api_token = var.cloudflare_api_token
}

# Use account_id directly from variables instead of lookup

# Create KV namespace for DOIs
resource "cloudflare_workers_kv_namespace" "dois" {
  account_id = var.cloudflare_account_id
  title      = var.kv_namespace_dois
}

# Create KV namespace for status
resource "cloudflare_workers_kv_namespace" "status" {
  account_id = var.cloudflare_account_id
  title      = var.kv_namespace_status
}

# Create the Worker script
resource "cloudflare_worker_script" "doi_checker" {
  account_id = var.cloudflare_account_id
  name       = var.worker_name
  content    = file("${path.module}/../src/worker.js")

  # Bind KV namespaces to the worker
  kv_namespace_binding {
    name         = "DOIS"
    namespace_id = cloudflare_workers_kv_namespace.dois.id
  }

  kv_namespace_binding {
    name         = "STATUS"
    namespace_id = cloudflare_workers_kv_namespace.status.id
  }

  # Add environment variables for snac2 configuration
  plain_text_binding {
    name = "SNAC2_SERVER_URL"
    text = var.snac2_server_url
  }
  
  # Use the appropriate authentication method based on configuration
  dynamic "secret_text_binding" {
    for_each = var.snac2_api_token != "" ? [1] : []
    content {
      name = "SNAC2_TOKEN"
      text = var.snac2_api_token
    }
  }
  
  dynamic "secret_text_binding" {
    for_each = var.snac2_bearer_token != "" ? [1] : []
    content {
      name = "SNAC2_BEARER_TOKEN"
      text = var.snac2_bearer_token
    }
  }
  
  dynamic "secret_text_binding" {
    for_each = var.snac2_username != "" ? [1] : []
    content {
      name = "SNAC2_USERNAME"
      text = var.snac2_username
    }
  }
  
  dynamic "secret_text_binding" {
    for_each = var.snac2_password != "" ? [1] : []
    content {
      name = "SNAC2_PASSWORD"
      text = var.snac2_password
    }
  }
}

# Create a custom domain route (optional)
resource "cloudflare_worker_route" "doi_checker" {
  count       = var.custom_domain_enabled ? 1 : 0
  zone_id     = var.custom_domain_zone_id
  pattern     = var.custom_domain_pattern
  script_name = cloudflare_worker_script.doi_checker.name
}

# Create cron trigger for scheduled checks
resource "cloudflare_worker_cron_trigger" "daily_check" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_worker_script.doi_checker.name
  cron        = var.cron_schedule
}

# Outputs
output "worker_url" {
  value = "https://${cloudflare_worker_script.doi_checker.name}.${var.cloudflare_account_id}.workers.dev"
}

output "kv_namespace_ids" {
  value = {
    dois   = cloudflare_workers_kv_namespace.dois.id
    status = cloudflare_workers_kv_namespace.status.id
  }
}
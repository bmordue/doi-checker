# terraform/variables.tf

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token with Workers and KV permissions"
  type        = string
  sensitive   = true
}

variable "worker_name" {
  description = "Name of the Cloudflare Worker"
  type        = string
  default     = "doi-checker"
}

variable "cron_schedules" {
  description = "Cron schedule for DOI checks (in cron format)"
  type        = list(string)
  default     = ["0 9 * * *"]  # Daily at 9 AM UTC
}

variable "kv_namespace_dois" {
  description = "Name for the DOIs KV namespace"
  type        = string
  default     = "doi-checker-dois"
}

variable "kv_namespace_status" {
  description = "Name for the status KV namespace"
  type        = string
  default     = "doi-checker-status"
}

variable "snac2_server_url" {
  description = "URL of your snac2 ActivityPub server"
  type        = string
}

variable "snac2_api_token" {
  description = "API token for snac2 authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "snac2_username" {
  description = "Username for snac2 basic authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "snac2_password" {
  description = "Password for snac2 basic authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "snac2_bearer_token" {
  description = "Bearer token for snac2 authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "custom_domain_enabled" {
  description = "Enable custom domain for the worker"
  type        = bool
  default     = false
}

variable "custom_domain_zone_id" {
  description = "Cloudflare Zone ID for custom domain"
  type        = string
  default     = ""
}

variable "custom_domain_pattern" {
  description = "URL pattern for custom domain routing"
  type        = string
  default     = ""
}

variable "max_dois_per_check" {
  description = "Maximum number of DOIs to check per execution"
  type        = number
  default     = 50
}

variable "doi_check_timeout" {
  description = "Timeout for individual DOI checks (milliseconds)"
  type        = number
  default     = 10000
}

variable "user_agent" {
  description = "User agent string for HTTP requests"
  type        = string
  default     = "DOI-Checker/1.0"
}

variable "max_retries" {
  description = "Maximum number of retries for failed DOI checks"
  type        = number
  default     = 3
}

variable "retry_delay_ms" {
  description = "Delay between retries (milliseconds)"
  type        = number
  default     = 1000
}

variable "notify_after_consecutive_failures" {
  description = "Only notify after this many consecutive failures"
  type        = number
  default     = 2
}

variable "max_post_length" {
  description = "Maximum length for ActivityPub posts"
  type        = number
  default     = 500
}

variable "include_urls_in_notifications" {
  description = "Include DOI URLs in failure notifications"
  type        = bool
  default     = true
}
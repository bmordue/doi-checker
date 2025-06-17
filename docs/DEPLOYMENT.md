## Deploying with Terraform

The project uses Terraform to manage Cloudflare resources. A deployment script `scripts/deploy.sh` is provided to simplify the deployment process.

### Prerequisites

1.  **Install Terraform:** Follow the official Terraform installation guide for your operating system.
2.  **Cloudflare Account:** You need a Cloudflare account.
3.  **Cloudflare API Token:** Generate a Cloudflare API token with the following permissions:
    *   Account Resources: Workers KV Storage:Edit
    *   Account Resources: Workers Scripts:Edit
    *   Account Settings:Read
    *   User Resources: Workers KV Storage:Edit (Not typically needed if using Account level token)
    *   User Resources: Workers Scripts:Edit (Not typically needed if using Account level token)
    *   Zone Resources: Workers Routes:Edit (If deploying to a custom domain)
4.  **Environment Variables or `.tfvars` file:**
    You need to provide your Cloudflare Account ID and API Token. You can do this in a few ways:
    *   **Environment Variables:**
        *   `TF_VAR_cloudflare_account_id`
        *   `TF_VAR_cloudflare_api_token`
    *   **`.tfvars` file:** Create a `terraform.tfvars` file in the `terraform/` directory. You can copy the `terraform/terraform.tfvars.example` file and rename it:
        ```bash
        cp terraform/terraform.tfvars.example terraform/terraform.tfvars
        ```
        Then, edit `terraform/terraform.tfvars` with your actual values:
        ```hcl
        cloudflare_account_id = "your_cloudflare_account_id"
        cloudflare_api_token  = "your_cloudflare_api_token"
        # worker_name = "my-doi-checker" # Optional: override default worker name
        # ... other variables
        ```
        **Important:** Add `terraform/terraform.tfvars` to your `.gitignore` file if it's not already there to avoid committing your secrets.

### Deployment Steps

1.  **Navigate to the project root.**
2.  **Run the deployment script:**
    ```bash
    ./scripts/deploy.sh
    ```
    This will change to the `terraform/` directory, run `terraform init`, and then `terraform apply -auto-approve`.

3.  **Passing Variables (Optional):**
    You can override Terraform variables directly from the command line:
    ```bash
    ./scripts/deploy.sh -var="worker_name=my-custom-worker"
    ```
    Or specify a variable file:
    ```bash
    ./scripts/deploy.sh -var-file="my_custom_vars.tfvars"
    ```

### Other Terraform Commands

You can use the `--terraform-command` argument to run other Terraform commands like `plan` or `destroy`.

*   **Plan:** To see what changes Terraform will make before applying them:
    ```bash
    ./scripts/deploy.sh --terraform-command "plan"
    ```
*   **Destroy:** To remove all resources managed by this Terraform configuration:
    ```bash
    ./scripts/deploy.sh --terraform-command "destroy"
    ```
    You will be prompted to confirm the destruction. To auto-approve destruction (use with caution):
    ```bash
    ./scripts/deploy.sh --terraform-command "destroy -auto-approve"
    ```

### Worker Output

After a successful deployment, Terraform will output the `worker_url` and `kv_namespace_ids`.

## Static Status Page Deployment

This project includes a static HTML page (`public/index.html`) that displays the current status of all monitored DOIs. This page is deployed using Cloudflare Pages.

### How it Works
- A Cloudflare Pages project has been configured in Terraform (`cloudflare_pages_project.status_page`).
- This Pages project is linked to the project's GitHub repository (specifically the `public/` directory on the production branch, e.g., "main").
- When changes are pushed to the `public/` directory on the production branch of the GitHub repository, Cloudflare Pages automatically rebuilds and deploys the static page.

### Accessing the Status Page
After a successful Terraform deployment (`./scripts/deploy.sh`) and once Cloudflare Pages has completed its deployment from the GitHub repository, the static status page will be available at the URL provided in the `status_page_url` Terraform output.

The URL will typically be in the format: `https://<pages_project_name>.pages.dev`.

### Important Notes
- **Initial Setup:** The very first time Terraform attempts to create the Cloudflare Pages project, or if the Cloudflare GitHub App permissions change, you might need to confirm or authorize access within the Cloudflare dashboard for the Pages project to connect to the GitHub repository.
- **Updates:** To update the static status page content (e.g., changes to `public/index.html`), you must commit and push those changes to the production branch of this GitHub repository. Terraform manages the Pages project *configuration*, but Cloudflare Pages itself handles deployments based on repository changes.

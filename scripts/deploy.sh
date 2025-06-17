#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Default Terraform command
TERRAFORM_COMMAND="apply -auto-approve"

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --terraform-command) TERRAFORM_COMMAND="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Change to the Terraform directory
cd "$(dirname "$0")/../terraform"

# Initialize Terraform
echo "Running terraform init..."
terraform init

# Apply Terraform configuration
echo "Running terraform $TERRAFORM_COMMAND..."
terraform $TERRAFORM_COMMAND "$@"

echo "Deployment complete."

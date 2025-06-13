# shell.nix - Development environment for DOI Checker

{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.claude-code

    # Node.js and npm
    pkgs.nodejs
#    pkgs.nodePackages.npm

    # GitHub CLI
    pkgs.gh

    # Terraform CLI
    pkgs.terraform

    # Claude CLI dependencies (requires Python 3)
#    pkgs.python311
#    pkgs.python311Packages.pip
#    pkgs.python311Packages.setuptools
#    pkgs.python311Packages.wheel

    # Additional useful tools
    pkgs.jq          # JSON processing
    pkgs.curl        # HTTP requests
    pkgs.git         # Version control
    pkgs.ripgrep     # Better grep
  ];

  shellHook = ''
    # Welcome message
    echo "🔗 DOI Checker Development Environment"
    echo "---------------------------------------"
    echo "• Node.js $(node -v)"
    echo "• npm $(npm -v)"
    echo "• Terraform $(terraform version -json | jq -r '.terraform_version')"
    echo "• GitHub CLI $(gh --version | head -n 1)"
    echo ""
    echo "• Run 'npm install' to install project dependencies"
    echo "• Run 'npm test' to run tests"
    echo "• Run 'npm run dev' to start local development server"
    echo ""

    # Setup Claude CLI if not already installed
 #   if ! command -v claude &> /dev/null; then
 #     echo "Claude CLI not found. Installing..."
 #     pip install --user claude-cli
 #     echo "Claude CLI installed. Please configure with 'claude auth login'"
 #     echo ""
 #   fi

    # Add local node_modules/.bin to PATH
    export PATH="$PWD/node_modules/.bin:$PATH"

    # Ensure Terraform can access Cloudflare credentials
    if [ -f "./terraform/terraform.tfvars" ]; then
      echo "Terraform configuration detected."
    else
      echo "⚠️  Terraform configuration not found."
      echo "   Copy terraform/terraform.tfvars.example to terraform/terraform.tfvars"
      echo "   and update with your Cloudflare credentials."
    fi
  '';
}

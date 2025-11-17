#!/bin/bash

##############################################################################
# Install Trivy for container image scanning
# https://aquasecurity.github.io/trivy/
##############################################################################

set -e

echo "Installing Trivy vulnerability scanner..."

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    sudo apt-get install wget apt-transport-https gnupg lsb-release -y
    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg > /dev/null
    echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
    sudo apt-get update
    sudo apt-get install trivy -y
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    brew install aquasecurity/trivy/trivy
else
    echo "Unsupported OS. Please install Trivy manually:"
    echo "https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
    exit 1
fi

echo "✓ Trivy installed successfully"
trivy --version

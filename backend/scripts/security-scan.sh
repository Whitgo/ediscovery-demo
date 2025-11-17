#!/bin/bash

##############################################################################
# Security Vulnerability Scanner for eDiscovery Application
# Runs multiple security checks and generates comprehensive report
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPORT_DIR="./security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🔒 Security Vulnerability Scanner           ║${NC}"
echo -e "${BLUE}║   eDiscovery Application                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Create report directory
mkdir -p "$REPORT_DIR"

##############################################################################
# 1. NPM Audit - Dependency Vulnerabilities
##############################################################################
echo -e "${BLUE}[1/5] Running npm audit on dependencies...${NC}"

cd backend
npm audit --json > "../$REPORT_DIR/npm-audit-backend-${TIMESTAMP}.json" 2>&1 || true
BACKEND_AUDIT_EXIT=$?

cd ../frontend
npm audit --json > "../$REPORT_DIR/npm-audit-frontend-${TIMESTAMP}.json" 2>&1 || true
FRONTEND_AUDIT_EXIT=$?

cd ..

# Parse audit results
BACKEND_CRITICAL=$(cat "$REPORT_DIR/npm-audit-backend-${TIMESTAMP}.json" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
BACKEND_HIGH=$(cat "$REPORT_DIR/npm-audit-backend-${TIMESTAMP}.json" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
BACKEND_MODERATE=$(cat "$REPORT_DIR/npm-audit-backend-${TIMESTAMP}.json" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")

FRONTEND_CRITICAL=$(cat "$REPORT_DIR/npm-audit-frontend-${TIMESTAMP}.json" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
FRONTEND_HIGH=$(cat "$REPORT_DIR/npm-audit-frontend-${TIMESTAMP}.json" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
FRONTEND_MODERATE=$(cat "$REPORT_DIR/npm-audit-frontend-${TIMESTAMP}.json" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")

echo -e "${GREEN}✓ npm audit complete${NC}"
echo -e "  Backend:  Critical: $BACKEND_CRITICAL | High: $BACKEND_HIGH | Moderate: $BACKEND_MODERATE"
echo -e "  Frontend: Critical: $FRONTEND_CRITICAL | High: $FRONTEND_HIGH | Moderate: $FRONTEND_MODERATE"
echo ""

##############################################################################
# 2. Outdated Packages Check
##############################################################################
echo -e "${BLUE}[2/5] Checking for outdated packages...${NC}"

cd backend
npm outdated --json > "../$REPORT_DIR/npm-outdated-backend-${TIMESTAMP}.json" 2>&1 || true
cd ../frontend
npm outdated --json > "../$REPORT_DIR/npm-outdated-frontend-${TIMESTAMP}.json" 2>&1 || true
cd ..

echo -e "${GREEN}✓ Outdated packages check complete${NC}"
echo ""

##############################################################################
# 3. Docker Image Scanning (if Trivy is installed)
##############################################################################
echo -e "${BLUE}[3/5] Scanning Docker images (if available)...${NC}"

if command -v trivy &> /dev/null; then
    # Check if images exist
    if docker images | grep -q "ediscovery-demo-backend"; then
        trivy image \
            --severity HIGH,CRITICAL \
            --format json \
            --output "$REPORT_DIR/trivy-backend-${TIMESTAMP}.json" \
            ediscovery-demo-backend:latest 2>&1 || true
        
        echo -e "${GREEN}✓ Backend image scanned${NC}"
    else
        echo -e "${YELLOW}⚠ Backend image not found, skipping${NC}"
    fi
    
    if docker images | grep -q "ediscovery-demo-frontend"; then
        trivy image \
            --severity HIGH,CRITICAL \
            --format json \
            --output "$REPORT_DIR/trivy-frontend-${TIMESTAMP}.json" \
            ediscovery-demo-frontend:latest 2>&1 || true
        
        echo -e "${GREEN}✓ Frontend image scanned${NC}"
    else
        echo -e "${YELLOW}⚠ Frontend image not found, skipping${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Trivy not installed, skipping Docker image scan${NC}"
    echo -e "  Install: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
fi
echo ""

##############################################################################
# 4. Git Secret Scanning
##############################################################################
echo -e "${BLUE}[4/5] Scanning for exposed secrets...${NC}"

# Check for common secret patterns
SECRET_PATTERNS=(
    "password.*=.*['\"].*['\"]"
    "api[_-]?key.*=.*['\"].*['\"]"
    "secret.*=.*['\"].*['\"]"
    "token.*=.*['\"].*['\"]"
    "aws[_-]?access"
    "private[_-]?key"
    "BEGIN.*PRIVATE.*KEY"
)

SECRET_FOUND=0
for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -i -E "$pattern" --include="*.js" --include="*.jsx" --include="*.json" --exclude-dir=node_modules --exclude-dir=coverage . > /dev/null 2>&1; then
        if [ $SECRET_FOUND -eq 0 ]; then
            echo -e "${RED}⚠ Potential secrets found in code:${NC}"
            SECRET_FOUND=1
        fi
        echo -e "  Pattern: $pattern"
    fi
done

if [ $SECRET_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No obvious secrets found in code${NC}"
fi
echo ""

##############################################################################
# 5. Security Headers Check (if server is running)
##############################################################################
echo -e "${BLUE}[5/5] Checking security headers...${NC}"

if curl -s http://localhost:4000 > /dev/null 2>&1; then
    HEADERS=$(curl -s -I http://localhost:4000 2>&1)
    
    echo "$HEADERS" > "$REPORT_DIR/http-headers-${TIMESTAMP}.txt"
    
    # Check for important security headers
    if echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
        echo -e "${GREEN}✓ X-Content-Type-Options header present${NC}"
    else
        echo -e "${YELLOW}⚠ X-Content-Type-Options header missing${NC}"
    fi
    
    if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
        echo -e "${GREEN}✓ X-Frame-Options header present${NC}"
    else
        echo -e "${YELLOW}⚠ X-Frame-Options header missing${NC}"
    fi
    
    if echo "$HEADERS" | grep -qi "Strict-Transport-Security"; then
        echo -e "${GREEN}✓ HSTS header present${NC}"
    else
        echo -e "${YELLOW}⚠ HSTS header missing${NC}"
    fi
    
    if echo "$HEADERS" | grep -qi "Content-Security-Policy"; then
        echo -e "${GREEN}✓ CSP header present${NC}"
    else
        echo -e "${YELLOW}⚠ Content-Security-Policy header missing${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Server not running, skipping header check${NC}"
fi
echo ""

##############################################################################
# Generate Summary Report
##############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📊 Security Scan Summary                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

TOTAL_CRITICAL=$((BACKEND_CRITICAL + FRONTEND_CRITICAL))
TOTAL_HIGH=$((BACKEND_HIGH + FRONTEND_HIGH))
TOTAL_MODERATE=$((BACKEND_MODERATE + FRONTEND_MODERATE))

# Create HTML report
cat > "$REPORT_DIR/security-summary-${TIMESTAMP}.html" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report - ${TIMESTAMP}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .severity-critical { color: #e74c3c; font-weight: bold; }
        .severity-high { color: #e67e22; font-weight: bold; }
        .severity-moderate { color: #f39c12; }
        .status-ok { color: #27ae60; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #3498db; color: white; }
        tr:hover { background-color: #f5f5f5; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; padding: 15px; background: #ecf0f1; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; display: block; }
        .metric-label { font-size: 12px; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 Security Vulnerability Scan Report</h1>
        <p><strong>Scan Date:</strong> $(date)</p>
        <p><strong>Application:</strong> eDiscovery Demo</p>
        
        <h2>📊 Vulnerability Overview</h2>
        <div class="metric">
            <span class="metric-value severity-critical">${TOTAL_CRITICAL}</span>
            <span class="metric-label">Critical</span>
        </div>
        <div class="metric">
            <span class="metric-value severity-high">${TOTAL_HIGH}</span>
            <span class="metric-label">High</span>
        </div>
        <div class="metric">
            <span class="metric-value severity-moderate">${TOTAL_MODERATE}</span>
            <span class="metric-label">Moderate</span>
        </div>
        
        <h2>Backend Dependencies</h2>
        <table>
            <tr>
                <th>Severity</th>
                <th>Count</th>
            </tr>
            <tr>
                <td class="severity-critical">Critical</td>
                <td>${BACKEND_CRITICAL}</td>
            </tr>
            <tr>
                <td class="severity-high">High</td>
                <td>${BACKEND_HIGH}</td>
            </tr>
            <tr>
                <td class="severity-moderate">Moderate</td>
                <td>${BACKEND_MODERATE}</td>
            </tr>
        </table>
        
        <h2>Frontend Dependencies</h2>
        <table>
            <tr>
                <th>Severity</th>
                <th>Count</th>
            </tr>
            <tr>
                <td class="severity-critical">Critical</td>
                <td>${FRONTEND_CRITICAL}</td>
            </tr>
            <tr>
                <td class="severity-high">High</td>
                <td>${FRONTEND_HIGH}</td>
            </tr>
            <tr>
                <td class="severity-moderate">Moderate</td>
                <td>${FRONTEND_MODERATE}</td>
            </tr>
        </table>
        
        <h2>Recommendations</h2>
        <ul>
            <li>Review and fix critical and high severity vulnerabilities immediately</li>
            <li>Run <code>npm audit fix</code> to automatically fix compatible issues</li>
            <li>Update outdated packages to latest secure versions</li>
            <li>Consider using <code>npm audit fix --force</code> for breaking changes (test thoroughly)</li>
            <li>Implement automated security scanning in CI/CD pipeline</li>
        </ul>
        
        <p style="margin-top: 40px; color: #7f8c8d; font-size: 12px;">
            Full reports available in: ${REPORT_DIR}
        </p>
    </div>
</body>
</html>
EOF

echo -e "${GREEN}✓ Security scan complete!${NC}"
echo ""
echo -e "📁 Reports saved to: ${BLUE}$REPORT_DIR/${NC}"
echo -e "📄 HTML Summary: ${BLUE}$REPORT_DIR/security-summary-${TIMESTAMP}.html${NC}"
echo ""

# Print summary to console
echo -e "${YELLOW}Vulnerability Summary:${NC}"
echo -e "  Total Critical: $TOTAL_CRITICAL"
echo -e "  Total High: $TOTAL_HIGH"
echo -e "  Total Moderate: $TOTAL_MODERATE"
echo ""

# Exit with error if critical vulnerabilities found
if [ $TOTAL_CRITICAL -gt 0 ]; then
    echo -e "${RED}❌ CRITICAL vulnerabilities found! Immediate action required.${NC}"
    exit 1
elif [ $TOTAL_HIGH -gt 5 ]; then
    echo -e "${YELLOW}⚠️  Multiple HIGH vulnerabilities found. Please review.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ No critical vulnerabilities detected${NC}"
    exit 0
fi

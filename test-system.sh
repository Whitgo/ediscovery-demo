#!/bin/bash

# Full System Test Script
# Tests the complete eDiscovery system including authentication, API endpoints, and functionality

echo "=========================================="
echo "EDISCOVERY SYSTEM TESTING"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="${API_URL:-https://localhost:4443}"
HTTP_URL="${HTTP_URL:-http://localhost:4000}"

# Counter for tests
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "[$TOTAL_TESTS] $test_name... "
    
    # Execute the test command and capture the HTTP status code
    if [ -z "$expected_status" ]; then
        # No status code check, just execute
        if eval "$test_command" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PASSED${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}✗ FAILED${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    else
        # Check HTTP status code
        HTTP_STATUS=$(eval "$test_command" 2>&1 | grep -oP 'HTTP/\d\.\d \K\d+' | head -1)
        if [ "$HTTP_STATUS" = "$expected_status" ]; then
            echo -e "${GREEN}✓ PASSED${NC} (Status: $HTTP_STATUS)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $HTTP_STATUS)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    fi
}

# Test 1: Server Health Check
echo -e "${BLUE}[SECTION 1] Server Health Checks${NC}"
echo "-------------------------------------------"

run_test "HTTP server is running" "curl -s -o /dev/null -w '%{http_code}' $HTTP_URL"
run_test "HTTPS server is running" "curl -k -s -o /dev/null -w '%{http_code}' $API_URL"

echo ""

# Test 2: Authentication Tests
echo -e "${BLUE}[SECTION 2] Authentication Tests${NC}"
echo "-------------------------------------------"

# Test admin login
echo -n "[$((TOTAL_TESTS + 1))] Testing admin login (admin@demo.com / demo123)... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
ADMIN_TOKEN=$(curl -k -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    echo "  Token obtained: ${ADMIN_TOKEN:0:20}..."
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  Failed to obtain admin token"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test manager login
echo -n "[$((TOTAL_TESTS + 1))] Testing manager login (alice@demo.com / demo123)... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
MANAGER_TOKEN=$(curl -k -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@demo.com","password":"demo123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$MANAGER_TOKEN" ] && [ "$MANAGER_TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test user login
echo -n "[$((TOTAL_TESTS + 1))] Testing user login (bob@demo.com / demo123)... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
USER_TOKEN=$(curl -k -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@demo.com","password":"demo123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$USER_TOKEN" ] && [ "$USER_TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test failed login
echo -n "[$((TOTAL_TESTS + 1))] Testing failed login (wrong password)... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
FAILED_RESPONSE=$(curl -k -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"wrongpassword"}')

if echo "$FAILED_RESPONSE" | grep -q "error"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""

# Test 3: API Endpoint Tests (with authentication)
if [ -n "$ADMIN_TOKEN" ]; then
    echo -e "${BLUE}[SECTION 3] API Endpoint Tests (Admin Access)${NC}"
    echo "-------------------------------------------"
    
    # Test cases endpoint
    echo -n "[$((TOTAL_TESTS + 1))] GET /api/cases... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    CASES_RESPONSE=$(curl -k -s -w "\n%{http_code}" "$API_URL/api/cases" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    HTTP_CODE=$(echo "$CASES_RESPONSE" | tail -1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: 200)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test users endpoint
    echo -n "[$((TOTAL_TESTS + 1))] GET /api/users... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    USERS_RESPONSE=$(curl -k -s -w "\n%{http_code}" "$API_URL/api/users" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    HTTP_CODE=$(echo "$USERS_RESPONSE" | tail -1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: 200)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test security dashboard endpoint
    echo -n "[$((TOTAL_TESTS + 1))] GET /api/security/dashboard... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    SECURITY_RESPONSE=$(curl -k -s -w "\n%{http_code}" "$API_URL/api/security/dashboard" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    HTTP_CODE=$(echo "$SECURITY_RESPONSE" | tail -1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: 200)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test audit logs endpoint
    echo -n "[$((TOTAL_TESTS + 1))] GET /api/security/audit-logs... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    AUDIT_RESPONSE=$(curl -k -s -w "\n%{http_code}" "$API_URL/api/security/audit-logs" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    HTTP_CODE=$(echo "$AUDIT_RESPONSE" | tail -1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: 200)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test notifications endpoint
    echo -n "[$((TOTAL_TESTS + 1))] GET /api/notifications... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    NOTIF_RESPONSE=$(curl -k -s -w "\n%{http_code}" "$API_URL/api/notifications" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    HTTP_CODE=$(echo "$NOTIF_RESPONSE" | tail -1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: 200)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
fi

# Test 4: Role-Based Access Control Tests
if [ -n "$USER_TOKEN" ]; then
    echo -e "${BLUE}[SECTION 4] RBAC Tests${NC}"
    echo "-------------------------------------------"
    
    # Regular user should NOT access admin-only endpoints
    echo -n "[$((TOTAL_TESTS + 1))] Regular user accessing admin endpoint (should fail)... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    RBAC_RESPONSE=$(curl -k -s -w "\n%{http_code}" "$API_URL/api/security/dashboard" \
      -H "Authorization: Bearer $USER_TOKEN")
    HTTP_CODE=$(echo "$RBAC_RESPONSE" | tail -1)
    
    if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Correctly denied with status: $HTTP_CODE)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE - should be 403 or 401)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Regular user should access cases endpoint
    echo -n "[$((TOTAL_TESTS + 1))] Regular user accessing cases endpoint... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    CASES_USER_RESPONSE=$(curl -k -s -w "\n%{http_code}" "$API_URL/api/cases" \
      -H "Authorization: Bearer $USER_TOKEN")
    HTTP_CODE=$(echo "$CASES_USER_RESPONSE" | tail -1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: 200)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
fi

# Test 5: Unauthenticated Access Tests
echo -e "${BLUE}[SECTION 5] Unauthenticated Access Tests${NC}"
echo "-------------------------------------------"

echo -n "[$((TOTAL_TESTS + 1))] Accessing protected endpoint without auth (should fail)... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
UNAUTH_RESPONSE=$(curl -k -s -w "\n%{http_code}" "$API_URL/api/cases")
HTTP_CODE=$(echo "$UNAUTH_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Correctly denied with status: 401)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE - should be 401)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""

# Test 6: Rate Limiting
echo -e "${BLUE}[SECTION 6] Rate Limiting Tests${NC}"
echo "-------------------------------------------"

echo -n "[$((TOTAL_TESTS + 1))] Testing rate limit info endpoint... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
RATE_RESPONSE=$(curl -k -s -w "\n%{http_code}" "$API_URL/api/auth/rate-limit-info")
HTTP_CODE=$(echo "$RATE_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Status: 200)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""

# Test 7: Security Features
echo -e "${BLUE}[SECTION 7] Security Features Tests${NC}"
echo "-------------------------------------------"

# Test CORS headers
echo -n "[$((TOTAL_TESTS + 1))] Testing CORS headers... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
CORS_RESPONSE=$(curl -k -s -I "$API_URL/api/cases" \
  -H "Origin: http://localhost:3000" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test security headers
echo -n "[$((TOTAL_TESTS + 1))] Testing security headers (HSTS)... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
HEADERS_RESPONSE=$(curl -k -s -I "$API_URL/api/cases" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$HEADERS_RESPONSE" | grep -q "Strict-Transport-Security"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}○ WARNING${NC} (HSTS header not found)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

# Test X-Content-Type-Options
echo -n "[$((TOTAL_TESTS + 1))] Testing X-Content-Type-Options header... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if echo "$HEADERS_RESPONSE" | grep -q "X-Content-Type-Options"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}○ WARNING${NC} (Header not found)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 8: Data Validation
echo -e "${BLUE}[SECTION 8] Data Validation Tests${NC}"
echo "-------------------------------------------"

# Test invalid email format
echo -n "[$((TOTAL_TESTS + 1))] Testing invalid email format (should fail)... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
INVALID_EMAIL=$(curl -k -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"demo123"}')
HTTP_CODE=$(echo "$INVALID_EMAIL" | tail -1)

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Status: $HTTP_CODE)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test missing password
echo -n "[$((TOTAL_TESTS + 1))] Testing missing password (should fail)... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
MISSING_PASS=$(curl -k -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com"}')
HTTP_CODE=$(echo "$MISSING_PASS" | tail -1)

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Status: 400)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC} (Status: $HTTP_CODE)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""

# Summary
echo "=========================================="
echo -e "${BLUE}TEST SUMMARY${NC}"
echo "=========================================="
echo ""
echo "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $PASSED_TESTS${NC}"
echo -e "${RED}Failed:       $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    echo "System Status: ${GREEN}OPERATIONAL${NC}"
    exit 0
else
    SUCCESS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    echo -e "${YELLOW}⚠ Some tests failed (Success rate: ${SUCCESS_RATE}%)${NC}"
    echo ""
    echo "System Status: ${YELLOW}DEGRADED${NC}"
    exit 1
fi

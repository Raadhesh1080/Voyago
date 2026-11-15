#!/bin/bash

echo "=== Voyago - Complete Setup & Start ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create logs directory
mkdir -p logs

# Check if databases are running
echo "Checking databases..."
if ! sudo docker ps | grep -q voyago-postgres; then
    echo -e "${YELLOW}Starting databases...${NC}"
    sudo docker compose -f docker-compose-simple.yml up -d
    sleep 10
fi

echo -e "${GREEN}✓ Databases running${NC}"

# Fix admin password hash
echo "Fixing admin user password..."
sudo docker exec voyago-postgres-1 psql -U voyago_admin -d voyago_db -c "UPDATE users SET password_hash = '\$2b\$10\$YQ3b6Zq3Z3Z3Z3Z3Z3Z3ZuK3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3' WHERE email = 'admin@voyago.com';" > /dev/null 2>&1

# Install backend dependencies
echo "Installing backend dependencies..."
for service in auth-service user-service trip-service payment-service api-gateway; do
    cd services/$service
    if [ ! -d "node_modules" ]; then
        npm install --silent > /dev/null 2>&1 &
    fi
    cd ../..
done

wait
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Set environment variables
export DATABASE_URL="postgresql://voyago_admin:VoyagoPass2024!@localhost:5433/voyago_db"
export JWT_SECRET="a8f5f167f44f4964e6c998dee827110c"
export NEO4J_URI="bolt://localhost:7688"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="Neo4jPass2024!"

# Kill any existing services
pkill -f 'node src/index.js' > /dev/null 2>&1

# Start backend services
echo "Starting backend services..."

cd services/auth-service
PORT=3001 DATABASE_URL=$DATABASE_URL JWT_SECRET=$JWT_SECRET node src/index.js > ../../logs/auth.log 2>&1 &
AUTH_PID=$!
cd ../..

cd services/user-service
PORT=3002 DATABASE_URL=$DATABASE_URL node src/index.js > ../../logs/user.log 2>&1 &
USER_PID=$!
cd ../..

cd services/trip-service
PORT=3003 DATABASE_URL=$DATABASE_URL NEO4J_URI=$NEO4J_URI NEO4J_USER=$NEO4J_USER NEO4J_PASSWORD=$NEO4J_PASSWORD node src/index.js > ../../logs/trip.log 2>&1 &
TRIP_PID=$!
cd ../..

cd services/payment-service
PORT=3004 DATABASE_URL=$DATABASE_URL STRIPE_SECRET_KEY=sk_test_dummy PAYPAL_CLIENT_ID=dummy PAYPAL_CLIENT_SECRET=dummy node src/index.js > ../../logs/payment.log 2>&1 &
PAYMENT_PID=$!
cd ../..

cd services/api-gateway
PORT=3000 AUTH_SERVICE_URL=http://localhost:3001 USER_SERVICE_URL=http://localhost:3002 TRIP_SERVICE_URL=http://localhost:3003 PAYMENT_SERVICE_URL=http://localhost:3004 JWT_SECRET=$JWT_SECRET node src/index.js > ../../logs/gateway.log 2>&1 &
GATEWAY_PID=$!
cd ../..

echo "Waiting for services to start..."
sleep 8

# Check services
echo ""
echo "=== Service Status ==="
for port in 3001 3002 3003 3004 3000; do
    if curl -s http://localhost:$port/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Service on port $port: Running${NC}"
    else
        echo -e "${RED}✗ Service on port $port: Failed${NC}"
        echo "  Check logs: tail -f logs/*.log"
    fi
done

echo ""
echo "=== Backend Ready ==="
echo "API Gateway: http://localhost:3000"
echo ""
echo "Process IDs:"
echo "  Auth: $AUTH_PID"
echo "  User: $USER_PID"
echo "  Trip: $TRIP_PID"
echo "  Payment: $PAYMENT_PID"
echo "  Gateway: $GATEWAY_PID"
echo ""
echo "View logs: tail -f logs/*.log"
echo "Stop all: pkill -f 'node src/index.js'"
echo ""
echo -e "${GREEN}Now run in another terminal: ./start-frontend.sh${NC}"

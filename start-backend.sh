#!/bin/bash

echo "=== Starting Backend Services ==="
echo ""

# Update database connection to use port 5433
export DATABASE_URL="postgresql://voyago_admin:VoyagoPass2024!@localhost:5432/voyago_db"
export JWT_SECRET="a8f5f167f44f4964e6c998dee827110c"
export NEO4J_URI="bolt://localhost:7688"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="Neo4jPass2024!"

# Start Auth Service
echo "Starting Auth Service on port 3001..."
cd services/auth-service
npm install > /dev/null 2>&1 &
sleep 2
PORT=3001 node src/index.js > ../../logs/auth.log 2>&1 &
echo "Auth Service PID: $!"

cd ../..

# Start User Service
echo "Starting User Service on port 3002..."
cd services/user-service
npm install > /dev/null 2>&1 &
sleep 2
PORT=3002 node src/index.js > ../../logs/user.log 2>&1 &
echo "User Service PID: $!"

cd ../..

# Start Trip Service
echo "Starting Trip Service on port 3003..."
cd services/trip-service
npm install > /dev/null 2>&1 &
sleep 2
PORT=3003 node src/index.js > ../../logs/trip.log 2>&1 &
echo "Trip Service PID: $!"

cd ../..

# Start Payment Service
echo "Starting Payment Service on port 3004..."
cd services/payment-service
npm install > /dev/null 2>&1 &
sleep 2
PORT=3004 DATABASE_URL=$DATABASE_URL STRIPE_SECRET_KEY=sk_test_dummy PAYPAL_CLIENT_ID=dummy PAYPAL_CLIENT_SECRET=dummy node src/index.js > ../../logs/payment.log 2>&1 &
echo "Payment Service PID: $!"

cd ../..

# Start API Gateway
echo "Starting API Gateway on port 3009..."
cd services/api-gateway
npm install > /dev/null 2>&1 &
sleep 2
PORT=3009 AUTH_SERVICE_URL=http://localhost:3001 USER_SERVICE_URL=http://localhost:3002 TRIP_SERVICE_URL=http://localhost:3003 PAYMENT_SERVICE_URL=http://localhost:3004 JWT_SECRET=$JWT_SECRET node src/index.js > ../../logs/gateway.log 2>&1 &
echo "API Gateway PID: $!"

cd ../..

echo ""
echo "=== Services Starting ==="
echo "Wait 10 seconds for services to initialize..."
sleep 10

echo ""
echo "=== Services Status ==="
curl -s http://localhost:3001/health && echo ""
curl -s http://localhost:3002/health && echo ""
curl -s http://localhost:3003/health && echo ""
curl -s http://localhost:3004/health && echo ""
curl -s http://localhost:3000/health && echo ""

echo ""
echo "=== Backend Ready ==="
echo "API Gateway: http://localhost:3009"
echo ""
echo "View logs: tail -f logs/*.log"
echo "Stop services: pkill -f 'node src/index.js'"

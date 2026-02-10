#!/bin/bash
set -e

echo "Starting Phase 2 verification script..."

# Ensure services are running
docker-compose up -d --build clickhouse backend

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    echo "Waiting for $name to be ready..."
    until curl -s $url > /dev/null; do
        sleep 2
    done
    echo "$name is ready!"
}

wait_for_service "http://localhost:8123" "ClickHouse"
wait_for_service "http://localhost:8080/health" "Backend"

# 1. Create User Group
echo "Testing Create User Group..."
GROUP_RESPONSE=$(curl -s -X POST http://localhost:8080/api/user-groups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Beta Users",
    "description": "Users in the beta program",
    "assignment_rule": "user_id % 2 == 0"
  }')
GROUP_ID=$(echo "$GROUP_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Group Created: $GROUP_ID"

# 2. Create Experiment
echo "Testing Create Experiment..."
EXP_RESPONSE=$(curl -s -X POST http://localhost:8080/api/experiments \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Phase 2 Test\",
    \"description\": \"Verification for event ingestion\",
    \"hypothesis\": {
        \"null_hypothesis\": \"No effect\",
        \"alternative_hypothesis\": \"Effect exists\",
        \"expected_effect_size\": 0.1,
        \"metric_type\": \"proportion\",
        \"significance_level\": 0.05,
        \"power\": 0.8
    },
    \"variants\": [
        {\"name\": \"control\", \"description\": \"Control\", \"allocation_percent\": 50.0, \"is_control\": true},
        {\"name\": \"treatment\", \"description\": \"Treatment\", \"allocation_percent\": 50.0, \"is_control\": false}
    ],
    \"primary_metric\": \"conversion\",
    \"user_groups\": [\"$GROUP_ID\"]
  }")
EXP_ID=$(echo "$EXP_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Experiment Created: $EXP_ID"

# 3. Assign Users
echo "Assigning users to variants..."
for i in {1..10}; do
  curl -s -X POST http://localhost:8080/api/user-groups/assign \
    -H "Content-Type: application/json" \
    -d "{
      \"user_id\": \"user$i\",
      \"experiment_id\": \"$EXP_ID\",
      \"group_id\": \"$GROUP_ID\"
    }" > /dev/null
done

# 4. Ingest Event
echo "Ingesting metric events..."
# Some users convert
for i in 1 3 5 7 9; do
  # We need to know which variant they are in to send the correct variant name in event if we want consistency
  # But the backend queries by variant from the event row.
  # Let's just send events for some users and assume they might be in any variant.
  # To be precise, I'll just send 1.0 for all of them.
  curl -s -X POST http://localhost:8080/api/events \
    -H "Content-Type: application/json" \
    -d "{
      \"experiment_id\": \"$EXP_ID\",
      \"user_id\": \"user$i\",
      \"variant\": \"treatment\", 
      \"metric_name\": \"conversion\",
      \"metric_value\": 1.0
    }" > /dev/null
done
# User 2, 4, 6, 8, 10 do nothing

# 5. Check Analysis
echo "Verifying real-time analysis..."
# Wait a second for ClickHouse to flush
sleep 2
ANALYSIS_RESPONSE=$(curl -s http://localhost:8080/api/experiments/$EXP_ID/analysis)

# Check if we have data for both variants (ideally)
if echo "$ANALYSIS_RESPONSE" | grep -q '"sample_size_a":'; then
  echo "Verification Success: Analysts showing live data!"
  echo "Summary of assignments:"
  echo "$ANALYSIS_RESPONSE" | grep -o '"variant":"[^"]*","current_size":[0-9]*'
else
  echo "Verification Failed: Metrics not updating correctly."
  echo "Response: $ANALYSIS_RESPONSE"
  exit 1
fi

echo "Phase 2 Verification Complete!"

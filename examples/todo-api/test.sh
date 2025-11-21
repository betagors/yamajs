#!/bin/bash

# Simple test script for todo-api

BASE_URL="http://localhost:4000"

echo "🧪 Testing Todo API"
echo "=================="
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
HEALTH=$(curl -s "$BASE_URL/health")
echo "   Response: $HEALTH"
echo ""

# Test create todo
echo "2. Creating a todo..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Todo", "completed": false}')
echo "   Response: $CREATE_RESPONSE"
TODO_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "   Created Todo ID: $TODO_ID"
echo ""

# Test get all todos
echo "3. Getting all todos..."
GET_ALL=$(curl -s "$BASE_URL/todos")
echo "   Response: $GET_ALL"
echo ""

# Test get todo by ID
if [ ! -z "$TODO_ID" ]; then
  echo "4. Getting todo by ID..."
  GET_ONE=$(curl -s "$BASE_URL/todos/$TODO_ID")
  echo "   Response: $GET_ONE"
  echo ""
  
  # Test update todo
  echo "5. Updating todo..."
  UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/todos/$TODO_ID" \
    -H "Content-Type: application/json" \
    -d '{"completed": true}')
  echo "   Response: $UPDATE_RESPONSE"
  echo ""
  
  # Test delete todo
  echo "6. Deleting todo..."
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/todos/$TODO_ID")
  echo "   Delete status: $DELETE_STATUS"
  echo ""
fi

echo "✅ Tests complete!"



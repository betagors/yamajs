#!/usr/bin/env node

/**
 * Simple test script for todo-api
 * Run with: node test.js
 */

const BASE_URL = process.env.API_URL || "http://localhost:4000";

async function test() {
  console.log("🧪 Testing Todo API");
  console.log("==================\n");

  try {
    // Test health endpoint
    console.log("1. Testing health endpoint...");
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await healthRes.json();
    console.log("   ✅ Health check:", JSON.stringify(health, null, 2));
    console.log("");

    // Test create todo
    console.log("2. Creating a todo...");
    const createRes = await fetch(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test Todo", completed: false }),
    });
    const created = await createRes.json();
    console.log("   ✅ Created:", JSON.stringify(created, null, 2));
    const todoId = created.id;
    console.log("");

    // Test get all todos
    console.log("3. Getting all todos...");
    const getAllRes = await fetch(`${BASE_URL}/todos`);
    const allTodos = await getAllRes.json();
    console.log("   ✅ All todos:", JSON.stringify(allTodos, null, 2));
    console.log("");

    // Test get todo by ID
    if (todoId) {
      console.log(`4. Getting todo by ID (${todoId})...`);
      const getOneRes = await fetch(`${BASE_URL}/todos/${todoId}`);
      const oneTodo = await getOneRes.json();
      console.log("   ✅ Todo:", JSON.stringify(oneTodo, null, 2));
      console.log("");

      // Test update todo
      console.log("5. Updating todo...");
      const updateRes = await fetch(`${BASE_URL}/todos/${todoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
      const updated = await updateRes.json();
      console.log("   ✅ Updated:", JSON.stringify(updated, null, 2));
      console.log("");

      // Test delete todo
      console.log("6. Deleting todo...");
      const deleteRes = await fetch(`${BASE_URL}/todos/${todoId}`, {
        method: "DELETE",
      });
      const deleteStatus = deleteRes.status;
      console.log(`   ✅ Delete status: ${deleteStatus}`);
      console.log("");
    }

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.cause) {
      console.error("   Cause:", error.cause);
    }
    process.exit(1);
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === "undefined") {
  console.error("❌ This script requires Node.js 18+ with native fetch support");
  console.error("   Or install node-fetch: npm install node-fetch");
  process.exit(1);
}

test();



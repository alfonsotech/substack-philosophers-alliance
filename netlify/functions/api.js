const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple test route to verify the function is working
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working!" });
});

// Load philosophers data
let philosophers = [];
try {
  philosophers = require("../../src/data/philosophers.json");
  console.log(
    `Loaded ${philosophers.length} philosophers from philosophers.json`
  );
} catch (error) {
  console.error("Error loading philosophers data:", error);
  philosophers = []; // Fallback to empty array
}

// API Routes
app.get("/api/philosophers", (req, res) => {
  res.json(philosophers);
});

app.get("/api/posts", (req, res) => {
  // For now, return empty array until we fix data persistence
  res.json({
    total: 0,
    page: 1,
    limit: 10,
    posts: [],
    hasMore: false,
  });
});

// Export the serverless function
module.exports.handler = serverless(app);

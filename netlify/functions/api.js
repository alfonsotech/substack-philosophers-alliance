const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

// Set Netlify environment variable
process.env.NETLIFY = "true";

// Import rssService with try/catch to handle potential errors
let rssService;
try {
  rssService = require("../../src/services/rssService");
} catch (error) {
  console.error("Error loading rssService:", error);
  // Create a minimal mock service if the real one fails to load
  rssService = {
    getAllPosts: () => [],
    getPostsByPhilosopher: () => [],
    getPhilosopherLogo: () => null,
    getLatestNewPosts: () => [],
  };
}

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
  // Use require instead of fs.readJsonSync for Netlify Functions
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
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    let posts = [];
    try {
      posts = rssService.getAllPosts();
    } catch (error) {
      console.error("Error getting posts:", error);
    }

    // Apply search filter if provided
    if (search && posts.length > 0) {
      const searchLower = search.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(searchLower) ||
          post.subtitle.toLowerCase().includes(searchLower) ||
          post.author.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    const paginatedPosts = posts.slice(startIndex, endIndex);

    res.json({
      total: posts.length,
      page: pageNum,
      limit: limitNum,
      posts: paginatedPosts,
      hasMore: endIndex < posts.length,
    });
  } catch (error) {
    console.error("Error in /api/posts:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

app.get("/api/philosophers/:id/posts", (req, res) => {
  try {
    const { id } = req.params;
    const posts = rssService.getPostsByPhilosopher(id);
    res.json(posts);
  } catch (error) {
    console.error(`Error in /api/philosophers/${req.params.id}/posts:`, error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

app.get("/api/philosophers/:id/logo", (req, res) => {
  try {
    const { id } = req.params;
    const logoUrl = rssService.getPhilosopherLogo(id);

    if (logoUrl) {
      // Redirect to the actual logo URL
      res.redirect(logoUrl);
    } else {
      // Instead of redirecting, send a 404 status
      res.status(404).json({ error: "Logo not found" });
    }
  } catch (error) {
    console.error(`Error in /api/philosophers/${req.params.id}/logo:`, error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

// Get all posts with error handling
function getAllPosts() {
  try {
    if (fs.existsSync(POSTS_FILE)) {
      return fs.readJsonSync(POSTS_FILE);
    }
  } catch (error) {
    console.error("Error reading posts file:", error);
  }

  // If we can't read the file or it doesn't exist, return an empty array
  return [];
}

// Export the serverless function
module.exports.handler = serverless(app);

const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const rssService = require("../../src/services/rssService");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Load philosophers data
let philosophers = [];
try {
  philosophers = fs.readJsonSync(
    path.join(__dirname, "../../src/data/philosophers.json")
  );
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
  const { search, page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  let posts = rssService.getAllPosts();

  // Apply search filter if provided
  if (search) {
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
});

app.get("/api/philosophers/:id/posts", (req, res) => {
  const { id } = req.params;
  const posts = rssService.getPostsByPhilosopher(id);
  res.json(posts);
});

app.get("/api/philosophers/:id/logo", (req, res) => {
  const { id } = req.params;
  const logoUrl = rssService.getPhilosopherLogo(id);

  if (logoUrl) {
    // Redirect to the actual logo URL
    res.redirect(logoUrl);
  } else {
    // Instead of redirecting, send a 404 status
    res.status(404).json({ error: "Logo not found" });
  }
});

// Add this endpoint to get the latest new posts
app.get("/api/latest-posts", (req, res) => {
  res.json(rssService.getLatestNewPosts());
});

// Export the serverless function
module.exports.handler = serverless(app);

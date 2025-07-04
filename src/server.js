const express = require("express");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
const fs = require("fs-extra");
const rssService = require("./services/rssService");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Load philosophers data
let philosophers = [];
try {
  philosophers = fs.readJsonSync(
    path.join(__dirname, "./data/philosophers.json")
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
  const { search, page = 1, limit = 10 } = req.query;
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

  // Calculate total pages
  const totalPosts = posts.length;
  const totalPages = Math.ceil(totalPosts / limitNum);

  // Apply pagination
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = pageNum * limitNum;
  const paginatedPosts = posts.slice(startIndex, endIndex);

  res.json({
    total: totalPosts,
    page: pageNum,
    limit: limitNum,
    hasMore: pageNum < totalPages,
    posts: paginatedPosts,
  });
});

app.get("/api/philosophers/:id/posts", (req, res) => {
  const { id } = req.params;
  const posts = rssService.getPostsByPhilosopher(id);
  res.json(posts);
});

// Add this endpoint to get a philosopher's logo
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

// Add a debug endpoint to check post images
app.get("/api/debug/posts", (req, res) => {
  const posts = rssService.getAllPosts();
  const imageInfo = posts.map((post) => ({
    title: post.title,
    hasImage: !!post.coverImage,
    imageUrl: post.coverImage || "none",
  }));

  res.json(imageInfo);
});

// Serve the diagnostic page
app.get("/diagnostic", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/diagnostic.html"));
});

// Initial feed refresh
rssService.refreshAllFeeds(philosophers).catch(console.error);

// Schedule feed refresh every 30 minutes
cron.schedule("*/30 * * * *", () => {
  rssService.refreshAllFeeds(philosophers).catch(console.error);
});

const RssParser = require("rss-parser");
const axios = require("axios");

// Create a simple parser for diagnostic purposes
const diagnosticParser = new RssParser({
  customFields: {
    item: [
      ["content:encoded", "content"],
      ["description", "description"],
      ["media:content", "media"],
      ["enclosure", "enclosure"],
    ],
    image: ["url", "title", "link"],
  },
});

// Add a diagnostic endpoint
app.get("/api/diagnostic/:id", async (req, res) => {
  const { id } = req.params;

  // Find the philosopher
  const philosopher = philosophers.find((p) => p.id === id);
  if (!philosopher) {
    return res.status(404).json({ error: "Philosopher not found" });
  }

  try {
    // Fetch the raw RSS feed
    const feed = await diagnosticParser.parseURL(philosopher.rssUrl);

    // Extract sample data from the first item
    const sampleItem = feed.items[0] || {};

    // Check for images in various places
    const imageLocations = {
      feedImage: feed.image ? feed.image.url : null,
      firstItemContent: sampleItem.content
        ? sampleItem.content.match(/<img[^>]+src="([^">]+)"/)
        : null,
      firstItemDescription: sampleItem.description
        ? sampleItem.description.match(/<img[^>]+src="([^">]+)"/)
        : null,
      firstItemMedia: sampleItem.media ? sampleItem.media : null,
      firstItemEnclosure: sampleItem.enclosure ? sampleItem.enclosure : null,
    };

    // Format the results
    const diagnosticResults = {
      philosopher: philosopher,
      feedTitle: feed.title,
      itemCount: feed.items.length,
      imageLocations: imageLocations,
      firstItemSample: {
        title: sampleItem.title,
        link: sampleItem.link,
        // Include a snippet of content to check for images
        contentSnippet: sampleItem.content
          ? sampleItem.content.substring(0, 500) + "..."
          : null,
        descriptionSnippet: sampleItem.description
          ? sampleItem.description.substring(0, 500) + "..."
          : null,
      },
    };

    res.json(diagnosticResults);
  } catch (error) {
    console.error(`Diagnostic error for ${philosopher.name}:`, error);
    res.status(500).json({
      error: "Error fetching diagnostic data",
      details: error.message,
    });
  }
});

// Add an endpoint to directly check images
app.get("/api/check-images/:id", async (req, res) => {
  const { id } = req.params;

  // Find the philosopher
  const philosopher = philosophers.find((p) => p.id === id);
  if (!philosopher) {
    return res.status(404).json({ error: "Philosopher not found" });
  }

  try {
    const images = await rssService.extractImagesFromFeed(philosopher.rssUrl);
    res.json(images);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error checking images", details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

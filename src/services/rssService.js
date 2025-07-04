const RssParser = require("rss-parser");
const fs = require("fs-extra");
const path = require("path");

// Configure the RSS parser to capture enclosure tags
const parser = new RssParser({
  customFields: {
    item: [
      ["content:encoded", "content"],
      ["description", "description"],
      ["enclosure", "enclosure"],
    ],
    image: ["url", "title", "link"],
  },
});

// Define the cache directories
const CACHE_DIR = path.join(__dirname, "../data/cache");
const POSTS_FILE = path.join(CACHE_DIR, "all-posts.json");
fs.ensureDirSync(CACHE_DIR);

// Extract subtitle from content or description
function extractSubtitle(content, description) {
  // Try to extract from content first
  if (content) {
    // Look for the first paragraph after removing HTML tags
    const contentText = content.replace(/<[^>]+>/g, " ").trim();
    const firstParagraph = contentText.split(/\n\s*\n/)[0];
    if (firstParagraph && firstParagraph.length > 0) {
      // Limit to a reasonable length for a subtitle
      return firstParagraph.length > 150
        ? firstParagraph.substring(0, 147) + "..."
        : firstParagraph;
    }
  }

  // Fall back to description
  if (description) {
    // Remove HTML tags and trim
    const descText = description.replace(/<[^>]+>/g, " ").trim();
    // Limit to a reasonable length for a subtitle
    return descText.length > 150
      ? descText.substring(0, 147) + "..."
      : descText;
  }

  return ""; // Return empty string if no subtitle found
}

// Extract the first image from content, description, or enclosure
function extractImage(item) {
  // 1. Check for enclosure tag first (this is where Substack puts the images)
  if (
    item.enclosure &&
    item.enclosure.url &&
    item.enclosure.type &&
    item.enclosure.type.startsWith("image/")
  ) {
    return item.enclosure.url;
  }

  // 2. Try content:encoded field
  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  // 3. Try description as fallback
  if (item.description) {
    const descImgMatch = item.description.match(/<img[^>]+src="([^">]+)"/);
    if (descImgMatch && descImgMatch[1]) {
      return descImgMatch[1];
    }
  }

  return null;
}

// Fetch feed for a philosopher
async function fetchFeed(philosopher) {
  try {
    console.log(`Fetching feed for ${philosopher.name}...`);
    const feed = await parser.parseURL(philosopher.rssUrl);

    console.log(`Feed for ${philosopher.name} has ${feed.items.length} items`);

    // Extract publication logo from feed
    let logoUrl = null;
    if (feed.image && feed.image.url) {
      logoUrl = feed.image.url;
      console.log(`Found logo for ${philosopher.name}: ${logoUrl}`);

      // Store the logo URL for this philosopher
      const logosDir = path.join(__dirname, "../data/logos");
      fs.ensureDirSync(logosDir);
      fs.writeJsonSync(path.join(logosDir, `${philosopher.id}.json`), {
        logoUrl,
      });
    }

    // Map feed items to our simplified format
    const posts = feed.items.map((item) => {
      // Extract cover image from enclosure, content, or description
      const coverImage = extractImage(item);

      if (coverImage) {
        console.log(`Found image for post "${item.title}": ${coverImage}`);
      } else {
        console.log(`No image found for post "${item.title}"`);
      }

      return {
        id: item.guid || item.link,
        title: item.title,
        subtitle: extractSubtitle(item.content, item.description),
        author: philosopher.name,
        publicationName: philosopher.publicationName || feed.title,
        publishDate: new Date(item.pubDate).toISOString(),
        link: item.link,
        philosopherId: philosopher.id,
        coverImage: coverImage,
        logoUrl: logoUrl,
      };
    });

    return posts;
  } catch (error) {
    console.error(`Error fetching feed for ${philosopher.name}:`, error);
    return [];
  }
}

// Get philosopher logo
function getPhilosopherLogo(philosopherId) {
  const logoFile = path.join(__dirname, `../data/logos/${philosopherId}.json`);

  if (fs.existsSync(logoFile)) {
    try {
      const data = fs.readJsonSync(logoFile);
      return data.logoUrl;
    } catch (error) {
      console.error(`Error reading logo for ${philosopherId}:`, error);
    }
  }

  return null;
}

// Refresh all feeds
async function refreshAllFeeds(philosophers) {
  console.log("Refreshing all feeds...");

  const allPosts = [];

  for (const philosopher of philosophers) {
    const posts = await fetchFeed(philosopher);
    allPosts.push(...posts);

    // Cache individual philosopher's posts
    const cacheFile = path.join(CACHE_DIR, `${philosopher.id}.json`);
    await fs.writeJson(cacheFile, posts);
  }

  // Sort all posts by date (newest first)
  allPosts.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

  // Save all posts to a single file
  await fs.writeJson(POSTS_FILE, allPosts);

  console.log(`Refreshed feeds: ${allPosts.length} posts found`);
  return allPosts;
}

// Get all posts
function getAllPosts() {
  if (fs.existsSync(POSTS_FILE)) {
    try {
      return fs.readJsonSync(POSTS_FILE);
    } catch (error) {
      console.error("Error reading posts file:", error);
      return [];
    }
  }
  return [];
}

// Get posts for a specific philosopher
function getPhilosopherPosts(philosopherId) {
  const cacheFile = path.join(CACHE_DIR, `${philosopherId}.json`);

  if (fs.existsSync(cacheFile)) {
    try {
      return fs.readJsonSync(cacheFile);
    } catch (error) {
      console.error(`Error reading posts for ${philosopherId}:`, error);
      return [];
    }
  }
  return [];
}

module.exports = {
  refreshAllFeeds,
  getAllPosts,
  getPhilosopherPosts,
  getPhilosopherLogo,
};

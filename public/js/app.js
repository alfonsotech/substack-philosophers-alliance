// State
let currentPage = 1;
let isLoading = false;
let hasMorePosts = true;
let currentSearch = "";
let philosophers = [];

// DOM Elements
const philosophersList = document.getElementById("philosophers-list");
const postsContainer = document.getElementById("posts-container");
const loadingElement = document.getElementById("loading");
const searchInput = document.getElementById("search-input");

// Fetch philosophers
async function fetchPhilosophers() {
  try {
    const response = await fetch("/api/philosophers");
    philosophers = await response.json();
    renderPhilosophers();
  } catch (error) {
    console.error("Error fetching philosophers:", error);
  }
}

// Render philosophers list
function renderPhilosophers() {
  philosophersList.innerHTML = philosophers
    .map((philosopher) => {
      const initial = philosopher.name.charAt(0).toUpperCase();
      return `
      <li class="philosopher-item">
        <div class="philosopher-logo-container">
          <img 
            src="/api/philosophers/${philosopher.id}/logo" 
            alt="${philosopher.name}" 
            class="philosopher-logo"
            onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22><rect width=%2224%22 height=%2224%22 fill=%22%23f0f0f0%22 /><text x=%2212%22 y=%2216%22 font-size=%2214%22 text-anchor=%22middle%22 fill=%22%23333%22>${initial}</text></svg>'"
          >
        </div>
        <a href="${philosopher.substackUrl}" target="_blank" data-id="${philosopher.id}">
          ${philosopher.name}
        </a>
      </li>
    `;
    })
    .join("");
}

// Fetch posts with pagination and search
async function fetchPosts(page = 1, search = "") {
  if (isLoading || (!hasMorePosts && page > 1)) return;

  isLoading = true;
  loadingElement.style.display = "block";

  try {
    const url = new URL("/api/posts", window.location.origin);
    url.searchParams.append("page", page);
    url.searchParams.append("limit", 10);
    if (search) url.searchParams.append("search", search);

    const response = await fetch(url);
    const data = await response.json();

    hasMorePosts = data.hasMore;

    renderPosts(data.posts, page === 1);
    currentPage = page;
  } catch (error) {
    console.error("Error fetching posts:", error);
  } finally {
    isLoading = false;
    loadingElement.style.display = hasMorePosts ? "block" : "none";
  }
}

// Render posts
function renderPosts(posts, clearExisting = false) {
  if (clearExisting) {
    postsContainer.innerHTML = "";
  }

  if (posts.length === 0 && clearExisting) {
    postsContainer.innerHTML = `
      <div class="no-results">
        <p>No posts found${
          currentSearch ? ` matching "${currentSearch}"` : ""
        }.</p>
      </div>
    `;
    return;
  }

  const postsHTML = posts
    .map((post) => {
      const initial = post.title.charAt(0).toUpperCase();
      return `
      <article class="post-card">
        <div class="post-image-container">
          ${
            post.coverImage
              ? `<img src="${post.coverImage}" alt="${post.title}" class="post-image" 
                 onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2290%22 viewBox=%220 0 120 90%22><rect width=%22120%22 height=%2290%22 fill=%22%23f0f0f0%22 /><text x=%2260%22 y=%2245%22 font-size=%2224%22 text-anchor=%22middle%22 fill=%22%23333%22>${initial}</text></svg>'">`
              : `<div class="post-image-placeholder">
               <svg width="120" height="90" viewBox="0 0 120 90">
                 <rect width="120" height="90" fill="#f0f0f0" />
                 <text x="60" y="45" font-size="24" text-anchor="middle" fill="#333">${initial}</text>
               </svg>
             </div>`
          }
        </div>
        <div class="post-content">
          <h2 class="post-title">
            <a href="${post.link}" target="_blank">${post.title}</a>
          </h2>
          <p class="post-subtitle">${post.subtitle}</p>
          <div class="post-meta">
            <span>${post.author} · ${post.publicationName}</span>
            <span>${formatDate(post.publishDate)}</span>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  postsContainer.insertAdjacentHTML("beforeend", postsHTML);
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Infinite scroll handler
function handleScroll() {
  if (isLoading || !hasMorePosts) return;

  const scrollPosition = window.innerHeight + window.scrollY;
  const bodyHeight = document.body.offsetHeight;

  // Load more posts when user scrolls to bottom (with 200px threshold)
  if (bodyHeight - scrollPosition < 200) {
    fetchPosts(currentPage + 1, currentSearch);
  }
}

// Search handler with debounce
let searchTimeout;
function handleSearch() {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const searchTerm = searchInput.value.trim();

    // Only search if term has changed
    if (searchTerm !== currentSearch) {
      currentSearch = searchTerm;
      currentPage = 1;
      hasMorePosts = true;
      fetchPosts(1, currentSearch);
    }
  }, 300); // 300ms debounce
}

// Initialize app
function init() {
  // Fetch initial data
  fetchPhilosophers();
  fetchPosts(1);

  // Add event listeners
  window.addEventListener("scroll", handleScroll);
  searchInput.addEventListener("input", handleSearch);

  // Add keyboard shortcut for search focus (Ctrl+K or Cmd+K)
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

// Start the app
init();

/* =====================================================
   PAWS & FOUND — app.js
   APIs used:
     1. dog.ceo/dog-api  → breed list + photos (no key)
     2. api-ninjas.com   → breed info/traits (free key)
   ===================================================== */

// ── CONFIG ────────────────────────────────────────────
// Sign up free at https://api-ninjas.com to get your key
const API_NINJAS_KEY = "YOUR_API_NINJAS_KEY_HERE";

const DOGCEO_BASE = "https://dog.ceo/api";
const NINJAS_BASE = "https://api.api-ninjas.com/v1/dogs";

// ── STATE ─────────────────────────────────────────────
let favorites = JSON.parse(localStorage.getItem("paws_favorites") || "[]");
let allBreeds = {};

// ── INIT ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  console.log("🐾 Paws & Found — app.js loaded");
  updateFavCount();

  const page = document.body.dataset.page;
  console.log(`📄 Current page: ${page}`);

  if (page === "index")     initSearchPage();
  if (page === "profile")   initProfilePage();
  if (page === "favorites") initFavoritesPage();
});

// ═══════════════════════════════════════════════════════
// PAGE: SEARCH / INDEX
// ═══════════════════════════════════════════════════════
async function initSearchPage() {
  console.log("🔍 Initializing search page...");
  await loadBreedDropdown();
  document.getElementById("search-btn").addEventListener("click", handleSearch);
  document.getElementById("apply-filters-btn").addEventListener("click", handleSearch);
  handleSearch(); // default load
}

async function loadBreedDropdown() {
  console.log("📡 Fetching breed list from dog.ceo...");
  const select = document.getElementById("breed-filter");
  try {
    const res  = await fetch(`${DOGCEO_BASE}/breeds/list/all`);
    if (!res.ok) throw new Error(`dog.ceo breeds responded with status ${res.status}`);
    const data = await res.json();
    allBreeds  = data.message;
    console.log(`✅ Loaded ${Object.keys(allBreeds).length} breeds`, allBreeds);

    Object.keys(allBreeds).sort().forEach(breed => {
      const subs = allBreeds[breed];
      if (subs.length === 0) {
        const opt = document.createElement("option");
        opt.value = breed;
        opt.textContent = capitalize(breed);
        select.appendChild(opt);
      } else {
        subs.forEach(sub => {
          const opt = document.createElement("option");
          opt.value = `${breed}/${sub}`;
          opt.textContent = `${capitalize(sub)} ${capitalize(breed)}`;
          select.appendChild(opt);
        });
      }
    });
  } catch (err) {
    console.error("❌ Failed to load breed list:", err.message);
    showError("data-container", "Could not load breeds. Check your connection and try again.");
  }
}

async function handleSearch() {
  const breedValue = document.getElementById("breed-filter").value;
  const breedPath  = breedValue || getRandomBreed();
  console.log("🔎 Search triggered — breed path:", breedPath);

  setLoadingState("data-container", 9);

  try {
    const [photos, breedInfo] = await Promise.all([
      fetchBreedPhotos(breedPath, 9),
      fetchBreedInfo(breedPath.split("/")[0])
    ]);

    console.log(`📸 Got ${photos.length} photos`);
    console.log("ℹ️ Breed info from api-ninjas:", breedInfo);

    renderBreedInfoBanner(breedInfo, breedPath);
    renderDogCards(photos, breedPath, breedInfo);

    document.getElementById("results-count").textContent =
      `Showing ${photos.length} ${formatBreedName(breedPath)} dogs`;

  } catch (err) {
    console.error("❌ Search failed:", err.message);
    showError("data-container", "Something went wrong fetching dogs. Please try again!");
  }
}

async function fetchBreedPhotos(breedPath, count = 9) {
  const url = `${DOGCEO_BASE}/breed/${breedPath}/images/random/${count}`;
  console.log(`📡 GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dog.ceo photos responded with status ${res.status}`);
  const data = await res.json();
  if (data.status !== "success") throw new Error("dog.ceo returned non-success status");
  return data.message;
}

async function fetchBreedInfo(breed) {
  const query = breed.replace(/-/g, " ");
  const url   = `${NINJAS_BASE}?name=${encodeURIComponent(query)}`;
  console.log(`📡 GET ${url}`);
  try {
    const res = await fetch(url, { headers: { "X-Api-Key": API_NINJAS_KEY } });
    if (!res.ok) throw new Error(`api-ninjas responded with status ${res.status}`);
    const data = await res.json();
    console.log("✅ api-ninjas raw response:", data);
    return data[0] || null;
  } catch (err) {
    console.warn("⚠️ Could not fetch breed info (api-ninjas) — continuing without it:", err.message);
    return null;
  }
}

function renderDogCards(photos, breedPath, breedInfo) {
  const container = document.getElementById("data-container");
  container.innerHTML = "";

  if (!photos || photos.length === 0) {
    showError("data-container", "No photos found for this breed.");
    return;
  }

  photos.forEach((imgUrl, i) => {
    const isSaved = favorites.some(f => f.imgUrl === imgUrl);
    const card    = document.createElement("div");
    card.className = "dog-card";

    card.innerHTML = `
      <div class="card-img-wrap">
        <img
          src="${imgUrl}"
          alt="${formatBreedName(breedPath)} dog"
          loading="lazy"
          onerror="this.src='https://placehold.co/400x300/E8DFD0/7C5C3E?text=No+photo'"
        />
        <button class="card-heart ${isSaved ? "saved" : ""}" data-img="${imgUrl}" data-breed="${breedPath}"
          title="${isSaved ? "Remove from favorites" : "Save to favorites"}">${isSaved ? "♥" : "♡"}</button>
      </div>
      <div class="card-body">
        <p class="card-dog-name">${formatBreedName(breedPath)}</p>
        <p class="card-dog-meta">
          ${breedInfo ? `${breedInfo.min_weight_male}–${breedInfo.max_weight_male} lbs &middot; ${breedInfo.min_life_expectancy}–${breedInfo.max_life_expectancy} yrs` : ""}
        </p>
      </div>
      <div class="card-footer">
        <span>🐾 Adoptable</span>
        <a href="profile.html?breed=${encodeURIComponent(breedPath)}&img=${encodeURIComponent(imgUrl)}" class="card-view-btn">View →</a>
      </div>
    `;

    card.querySelector(".card-heart").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite({ imgUrl, breed: breedPath });
      const nowSaved = favorites.some(f => f.imgUrl === imgUrl);
      e.currentTarget.textContent = nowSaved ? "♥" : "♡";
      e.currentTarget.classList.toggle("saved", nowSaved);
      console.log(`${nowSaved ? "💾 Saved" : "🗑️ Removed"} favorite:`, imgUrl);
    });

    container.appendChild(card);
  });

  console.log(`✅ Rendered ${photos.length} dog cards`);
}

function renderBreedInfoBanner(breedInfo, breedPath) {
  const old = document.getElementById("breed-banner");
  if (old) old.remove();
  if (!breedInfo) return;

  const banner = document.createElement("div");
  banner.id = "breed-banner";
  banner.className = "breed-banner";
  banner.innerHTML = `
    <div class="breed-banner-inner">
      <h2 class="breed-banner-title">${formatBreedName(breedPath)}</h2>
      <div class="breed-banner-stats">
        <div class="stat"><span class="stat-label">Energy</span><span class="stat-val">${energyLabel(breedInfo.energy)}</span></div>
        <div class="stat"><span class="stat-label">Playfulness</span><span class="stat-val">${energyLabel(breedInfo.playfulness)}</span></div>
        <div class="stat"><span class="stat-label">Barking</span><span class="stat-val">${barkLabel(breedInfo.barking)}</span></div>
        <div class="stat"><span class="stat-label">Kids</span><span class="stat-val">${breedInfo.good_with_children ? "Great ✓" : "Adults preferred"}</span></div>
        <div class="stat"><span class="stat-label">Weight</span><span class="stat-val">${breedInfo.min_weight_male}–${breedInfo.max_weight_male} lbs</span></div>
        <div class="stat"><span class="stat-label">Life Span</span><span class="stat-val">${breedInfo.min_life_expectancy}–${breedInfo.max_life_expectancy} yrs</span></div>
      </div>
    </div>
  `;

  const main = document.querySelector(".main-content");
  main.insertBefore(banner, main.firstChild);
}

// ═══════════════════════════════════════════════════════
// PAGE: PROFILE
// ═══════════════════════════════════════════════════════
async function initProfilePage() {
  console.log("🐶 Initializing profile page...");
  const params  = new URLSearchParams(window.location.search);
  const breed   = params.get("breed");
  const mainImg = params.get("img");

  if (!breed) {
    console.error("❌ No breed param found in URL");
    showError("profile-container", "No dog selected. Go back and choose one!");
    return;
  }

  console.log(`📋 Profile — breed: "${breed}", img: "${mainImg}"`);

  const mainPhotoEl      = document.getElementById("main-photo");
  const photoPlaceholder = document.getElementById("photo-placeholder");

  if (mainImg) {
    mainPhotoEl.src = mainImg;
    mainPhotoEl.style.display = "block";
    photoPlaceholder.style.display = "none";
  }

  document.getElementById("dog-name").textContent = formatBreedName(breed);
  document.getElementById("dog-meta").textContent = "Loading details...";

  try {
    const [photos, breedInfo] = await Promise.all([
      fetchBreedPhotos(breed, 6),
      fetchBreedInfo(breed.split("/")[0])
    ]);
    console.log(`📸 Got ${photos.length} gallery photos`);
    renderProfileGallery(photos, mainImg, breed);
    renderProfileDetails(breedInfo, breed);
  } catch (err) {
    console.error("❌ Profile load error:", err.message);
    document.getElementById("dog-meta").textContent = "Could not load all details.";
  }

  // Favorite button
  const favBtn  = document.getElementById("favorite-btn");
  const isSaved = favorites.some(f => f.breed === breed && f.imgUrl === mainImg);
  favBtn.textContent = isSaved ? "♥ Saved!" : "♡ Save to Favorites";
  favBtn.classList.toggle("saved", isSaved);

  favBtn.addEventListener("click", () => {
    toggleFavorite({ imgUrl: mainImg, breed });
    const nowSaved = favorites.some(f => f.breed === breed && f.imgUrl === mainImg);
    favBtn.textContent = nowSaved ? "♥ Saved!" : "♡ Save to Favorites";
    favBtn.classList.toggle("saved", nowSaved);
    console.log(`${nowSaved ? "💾 Saved" : "🗑️ Removed"} profile favorite:`, breed);
  });
}

function renderProfileGallery(photos, mainImg, breed) {
  const thumbsContainer = document.getElementById("thumbs-container");
  const mainPhotoEl     = document.getElementById("main-photo");
  thumbsContainer.innerHTML = "";

  const allPhotos = mainImg
    ? [mainImg, ...photos.filter(p => p !== mainImg)].slice(0, 6)
    : photos.slice(0, 6);

  allPhotos.forEach((url, i) => {
    const thumb = document.createElement("img");
    thumb.src   = url;
    thumb.alt   = `${formatBreedName(breed)} photo ${i + 1}`;
    thumb.className = `thumb-img ${i === 0 ? "active" : ""}`;
    thumb.loading   = "lazy";
    thumb.onerror   = () => { thumb.style.display = "none"; };

    thumb.addEventListener("click", () => {
      mainPhotoEl.src = url;
      document.querySelectorAll(".thumb-img").forEach(t => t.classList.remove("active"));
      thumb.classList.add("active");
      console.log(`🖼️ Switched main photo to: ${url}`);
    });

    thumbsContainer.appendChild(thumb);
  });

  console.log(`✅ Gallery rendered — ${allPhotos.length} photos`);
}

function renderProfileDetails(breedInfo, breed) {
  const metaEl = document.getElementById("dog-meta");

  if (!breedInfo) {
    metaEl.textContent = `${formatBreedName(breed)} · Available for adoption`;
    document.getElementById("dog-description").textContent =
      "Contact your local shelter for more information about this dog.";
    console.warn("⚠️ No breed info available — showing fallback text");
    return;
  }

  metaEl.textContent = `${formatBreedName(breed)} · ${breedInfo.min_weight_male}–${breedInfo.max_weight_male} lbs · ${breedInfo.min_life_expectancy}–${breedInfo.max_life_expectancy} yrs`;

  document.getElementById("dog-description").textContent =
    `The ${formatBreedName(breed)} is a wonderful companion. ` +
    `This breed has ${energyLabel(breedInfo.energy).toLowerCase()} energy and ` +
    `${breedInfo.good_with_children ? "is great with children." : "does best in a home without small children."} ` +
    `They tend to be ${barkLabel(breedInfo.barking).toLowerCase()} and love spending time with their family.`;

  const traits = [];
  if (breedInfo.good_with_children)  traits.push("Good with Kids");
  if (breedInfo.good_with_other_dogs) traits.push("Dog-Friendly");
  if (breedInfo.shedding   <= 2)     traits.push("Low Shedding");
  if (breedInfo.energy     >= 4)     traits.push("High Energy");
  if (breedInfo.trainability >= 4)   traits.push("Easy to Train");
  if (breedInfo.playfulness  >= 4)   traits.push("Very Playful");

  const traitsEl = document.getElementById("traits-container");
  traitsEl.innerHTML = "";
  (traits.length > 0 ? traits : ["Friendly", "Loving"]).forEach(t => {
    const pill = document.createElement("span");
    pill.className   = "trait-pill";
    pill.textContent = t;
    traitsEl.appendChild(pill);
  });

  document.getElementById("badge-vaccinated").style.display   = "inline-block";
  document.getElementById("badge-housetrained").style.display = "inline-block";
  document.getElementById("shelter-name").textContent  = "Local Animal Shelter";
  document.getElementById("shelter-phone").textContent = "📞 Contact your local shelter to inquire";
  document.getElementById("shelter-email").textContent = "🔗 Find on Petfinder.com";

  console.log("✅ Profile details rendered:", formatBreedName(breed));
}

// ═══════════════════════════════════════════════════════
// PAGE: FAVORITES
// ═══════════════════════════════════════════════════════
function initFavoritesPage() {
  console.log("❤️ Initializing favorites page...");
  console.log(`📦 ${favorites.length} saved favorites in localStorage:`, favorites);

  const container  = document.getElementById("favorites-container");
  const emptyState = document.getElementById("favorites-empty");
  const authWall   = document.getElementById("auth-wall");

  authWall.style.display  = "none";
  container.style.display = "grid";

  if (favorites.length === 0) {
    emptyState.style.display = "block";
    container.style.display  = "none";
    console.log("ℹ️ No favorites to display");
    return;
  }

  favorites.forEach(({ imgUrl, breed }) => {
    const card = document.createElement("div");
    card.className = "dog-card";
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${imgUrl}" alt="${formatBreedName(breed)}" loading="lazy"
          onerror="this.src='https://placehold.co/400x300/E8DFD0/7C5C3E?text=No+photo'" />
        <button class="card-heart saved" title="Remove from favorites">♥</button>
      </div>
      <div class="card-body">
        <p class="card-dog-name">${formatBreedName(breed)}</p>
        <p class="card-dog-meta">Saved to favorites</p>
      </div>
      <div class="card-footer">
        <span>🐾 Saved</span>
        <a href="profile.html?breed=${encodeURIComponent(breed)}&img=${encodeURIComponent(imgUrl)}" class="card-view-btn">View →</a>
      </div>
    `;

    card.querySelector(".card-heart").addEventListener("click", () => {
      toggleFavorite({ imgUrl, breed });
      card.remove();
      console.log("🗑️ Removed from favorites:", breed);
      if (favorites.length === 0) {
        emptyState.style.display = "block";
        container.style.display  = "none";
      }
    });

    container.appendChild(card);
  });

  console.log(`✅ Rendered ${favorites.length} favorite cards`);
}

// ═══════════════════════════════════════════════════════
// FAVORITES — localStorage (swap for Firebase later)
// ═══════════════════════════════════════════════════════
function toggleFavorite(dog) {
  const idx = favorites.findIndex(f => f.imgUrl === dog.imgUrl);
  if (idx === -1) {
    favorites.push(dog);
    console.log("💾 Added to favorites:", dog.breed);
  } else {
    favorites.splice(idx, 1);
    console.log("🗑️ Removed from favorites:", dog.breed);
  }
  localStorage.setItem("paws_favorites", JSON.stringify(favorites));
  updateFavCount();
}

function updateFavCount() {
  document.querySelectorAll("#fav-count").forEach(el => {
    el.textContent = favorites.length;
    el.style.display = favorites.length > 0 ? "inline-block" : "none";
  });
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function setLoadingState(containerId, count = 6) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  for (let i = 0; i < count; i++) {
    el.innerHTML += `
      <div class="dog-card placeholder-card">
        <div class="card-img-wrap"><div class="img-placeholder"></div></div>
        <div class="card-body">
          <div class="placeholder-line w-60"></div>
          <div class="placeholder-line w-40"></div>
        </div>
      </div>`;
  }
  console.log(`⏳ Skeleton loading shown (${count} placeholders)`);
}

function showError(containerId, message) {
  document.getElementById(containerId).innerHTML = `
    <div class="empty-state" style="grid-column:1/-1;">
      <p class="empty-icon">😕</p>
      <h2>Oops!</h2>
      <p>${message}</p>
      <button class="btn-primary" onclick="location.reload()">Try Again</button>
    </div>`;
  console.error(`🚨 Error shown to user: "${message}"`);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatBreedName(breedPath) {
  const parts = breedPath.split("/");
  if (parts.length === 2) return `${capitalize(parts[1])} ${capitalize(parts[0])}`;
  return capitalize(parts[0]);
}

function getRandomBreed() {
  const breeds = Object.keys(allBreeds);
  if (breeds.length === 0) return "retriever/golden";
  return breeds[Math.floor(Math.random() * breeds.length)];
}

function energyLabel(val) {
  if (val === undefined || val === null) return "Unknown";
  if (val >= 5) return "Very High";
  if (val >= 4) return "High";
  if (val >= 3) return "Moderate";
  if (val >= 2) return "Low";
  return "Very Low";
}

function barkLabel(val) {
  if (val === undefined || val === null) return "Unknown";
  if (val >= 5) return "Very Vocal";
  if (val >= 3) return "Moderate";
  return "Quiet";
}
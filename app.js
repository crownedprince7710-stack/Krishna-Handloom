
/* ==========================================
   THE KRISHNA HANDLOOM
   Customer Website - Upgraded Application
========================================== */


/* 1. CONFIGURATION */

const WHATSAPP_NUMBER = "918284008674";

const db = window.supabaseClient;


/* 2. GLOBAL STATE */

let allProducts = [];
let allCategories = [];
let allSubcategories = [];

let activeCategory = "all";
let activeSubcategory = "all";
let searchQuery = "";

let currentGalleryImages = [];
let currentGalleryIndex = 0;


/* 3. DOM ELEMENTS */

const productGrid = document.getElementById("productGrid");
const categoryGrid = document.getElementById("categoryGrid");

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

const activeFilter = document.getElementById("activeFilter");
const emptyState = document.getElementById("emptyState");

const productModal = document.getElementById("productModal");
const modalClose = document.getElementById("modalClose");

const menuToggle = document.getElementById("menuToggle");
const navigation = document.getElementById("navigation");


/* 4. DEFAULT CATEGORY IMAGES */

const CATEGORY_IMAGES = {

    blanket:
        "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=700",

    blankets:
        "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=700",

    bedsheet:
        "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=700",

    bedsheets:
        "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=700",

    curtains:
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=700",

    default:
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=700"

};


/* 5. HELPERS */

function escapeHTML(value = "") {

    return String(value).replace(/[&<>"']/g, char => ({

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

    })[char]);

}


function getCategoryName(category) {

    if (typeof category === "string") {
        return category;
    }

    return category?.name || "";

}


function getProductImages(product) {

    if (Array.isArray(product.images) && product.images.length) {

        return product.images.filter(Boolean);

    }

    if (product.image_url) {

        return [product.image_url];

    }

    return [];

}


function getProductCategory(product) {

    return allCategories.find(

        category => String(category.id) === String(product.category_id)

    );

}


function getProductSubcategory(product) {

    return allSubcategories.find(

        subcategory => String(subcategory.id) === String(product.subcategory_id)

    );

}


function getProductLink(product) {

    const url = new URL(window.location.href);

    url.search = "";
    url.hash = "";

    url.searchParams.set("product", product.id);

    return url.toString();

}


function getWhatsAppLink(message) {

    const number = WHATSAPP_NUMBER.replace(/\D/g, "");

    if (!number || number.includes("XXXXXXXXXX")) {

        alert("WhatsApp number has not been configured yet.");

        return null;

    }

    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

}


function getCategoryFallback(category) {

    const name = getCategoryName(category).toLowerCase();

    return CATEGORY_IMAGES[name] || CATEGORY_IMAGES.default;

}


/* 6. CREATE SUBCATEGORY FILTER */

function setupSubcategoryFilter() {

    const controls = document.querySelector(".product-controls");

    if (!controls) return;

    let filter = document.getElementById("subcategoryFilter");

    if (!filter) {

        filter = document.createElement("select");

        filter.id = "subcategoryFilter";

        filter.setAttribute("aria-label", "Filter by subcategory");

        filter.innerHTML = `

            <option value="all">All Subcategories</option>

        `;

        controls.appendChild(filter);

    }

    filter.addEventListener("change", event => {

        activeSubcategory = event.target.value;

        renderProducts();

    });

}


/* 7. LOAD DATA FROM SUPABASE */

async function loadWebsiteData() {

    try {

        if (!window.supabaseClient) {

            throw new Error("Supabase connection is not configured.");

        }

        const [

            categoryResult,

            subcategoryResult,

            productResult

        ] = await Promise.all([

            db
                .from("categories")
                .select("*")
                .order("name"),

            db
                .from("subcategories")
                .select("*")
                .order("name"),

            db
                .from("products")
                .select("*")
                .order("created_at", { ascending: false })

        ]);


        if (categoryResult.error) {
            throw categoryResult.error;
        }

        if (subcategoryResult.error) {
            throw subcategoryResult.error;
        }

        if (productResult.error) {
            throw productResult.error;
        }


        allCategories = categoryResult.data || [];

        allSubcategories = subcategoryResult.data || [];

        allProducts = productResult.data || [];


        setupSubcategoryFilter();

        renderCategories();

        renderCategoryFilter();

        renderSubcategoryFilter();

        renderProducts();

        openProductFromURL();


    } catch (error) {

        console.error("Website loading error:", error);

        if (productGrid) {

            productGrid.innerHTML = `

                <div class="loading-message">

                    <h3>Our collection is temporarily unavailable.</h3>

                    <p>Please try again in a moment.</p>

                    <button class="secondary-btn" onclick="loadWebsiteData()">
                        Try Again
                    </button>

                </div>

            `;

        }

    }

}


/* 8. CATEGORY GRID */

function renderCategories() {

    if (!categoryGrid) return;


    if (!allCategories.length) {

        categoryGrid.innerHTML = `

            <div class="loading-message">
                Collections coming soon.
            </div>

        `;

        return;

    }


    categoryGrid.innerHTML = allCategories.map(category => {

        const name = getCategoryName(category);

        const image =

            category.image_url ||

            getCategoryFallback(category);


        return `

            <article

                class="category-card"

                data-category-id="${escapeHTML(category.id)}"

                tabindex="0"

                role="button"

                aria-label="Explore ${escapeHTML(name)}"

            >

                <img

                    src="${escapeHTML(image)}"

                    alt="${escapeHTML(name)}"

                    loading="lazy"

                >

                <div class="category-info">

                    <h3>${escapeHTML(name)}</h3>

                    <span>Explore Collection →</span>

                </div>

            </article>

        `;

    }).join("");


    categoryGrid.querySelectorAll(".category-card").forEach(card => {

        const select = () => {

            selectCategory(card.dataset.categoryId);

        };


        card.addEventListener("click", select);


        card.addEventListener("keydown", event => {

            if (event.key === "Enter" || event.key === " ") {

                event.preventDefault();

                select();

            }

        });

    });

}


/* 9. CATEGORY DROPDOWN */

function renderCategoryFilter() {

    if (!categoryFilter) return;


    categoryFilter.innerHTML = `

        <option value="all">All Categories</option>

        ${allCategories.map(category => `

            <option value="${escapeHTML(category.id)}">

                ${escapeHTML(getCategoryName(category))}

            </option>

        `).join("")}

    `;


    categoryFilter.value = activeCategory;

}


/* 10. SUBCATEGORY DROPDOWN */

function renderSubcategoryFilter() {

    const filter = document.getElementById("subcategoryFilter");

    if (!filter) return;


    const availableSubcategories = allSubcategories.filter(subcategory => {

        return (

            activeCategory === "all" ||

            String(subcategory.category_id) === activeCategory

        );

    });


    filter.innerHTML = `

        <option value="all">All Subcategories</option>

        ${availableSubcategories.map(subcategory => `

            <option value="${escapeHTML(subcategory.id)}">

                ${escapeHTML(subcategory.name)}

            </option>

        `).join("")}

    `;


    const stillAvailable = availableSubcategories.some(

        item => String(item.id) === activeSubcategory

    );


    if (!stillAvailable) {

        activeSubcategory = "all";

    }


    filter.value = activeSubcategory;

}


/* 11. CATEGORY SELECTION */

function selectCategory(categoryId) {

    activeCategory = String(categoryId);

    activeSubcategory = "all";


    if (categoryFilter) {

        categoryFilter.value = activeCategory;

    }


    renderSubcategoryFilter();

    renderProducts();


    document.getElementById("products")?.scrollIntoView({

        behavior: "smooth"

    });

}


/* 12. PRODUCT FILTERING */

function getFilteredProducts() {

    return allProducts.filter(product => {

        const matchesCategory =

            activeCategory === "all" ||

            String(product.category_id) === activeCategory;


        const matchesSubcategory =

            activeSubcategory === "all" ||

            String(product.subcategory_id) === activeSubcategory;


        const name = String(product.name || "").toLowerCase();


        const description = String(

            product.description || ""

        ).toLowerCase();


        const category = getProductCategory(product);

        const subcategory = getProductSubcategory(product);


        const categoryName = getCategoryName(category).toLowerCase();

        const subcategoryName = String(

            subcategory?.name || ""

        ).toLowerCase();


        const matchesSearch =

            name.includes(searchQuery) ||

            description.includes(searchQuery) ||

            categoryName.includes(searchQuery) ||

            subcategoryName.includes(searchQuery);


        return (

            matchesCategory &&

            matchesSubcategory &&

            matchesSearch

        );

    });

}


/* 13. PRODUCT GRID */

function renderProducts() {

    if (!productGrid) return;


    const filteredProducts = getFilteredProducts();


    const selectedCategory = allCategories.find(

        category => String(category.id) === activeCategory

    );


    if (activeFilter) {

        let filterText = "Showing all products";

        if (activeCategory !== "all") {

            filterText = getCategoryName(selectedCategory);

        }

        if (activeSubcategory !== "all") {

            const selectedSubcategory = allSubcategories.find(

                item => String(item.id) === activeSubcategory

            );

            filterText += ` · ${selectedSubcategory?.name || ""}`;

        }

        activeFilter.textContent =

            `${filterText} · ${filteredProducts.length} products`;

    }


    if (!filteredProducts.length) {

        productGrid.innerHTML = "";


        if (emptyState) {

            emptyState.hidden = false;

        }

        return;

    }


    if (emptyState) {

        emptyState.hidden = true;

    }


    productGrid.innerHTML = filteredProducts.map(product => {

        const images = getProductImages(product);

        const image = images[0] || CATEGORY_IMAGES.default;


        const category = getProductCategory(product);

        const subcategory = getProductSubcategory(product);


        const categoryLabel = [

            getCategoryName(category),

            subcategory?.name

        ].filter(Boolean).join(" · ");


        return `

            <article

                class="product-card"

                data-product-id="${escapeHTML(product.id)}"

                tabindex="0"

                role="button"

                aria-label="View ${escapeHTML(product.name)}"

            >

                <div class="product-image">

                    <img

                        src="${escapeHTML(image)}"

                        alt="${escapeHTML(product.name)}"

                        loading="lazy"

                    >

                    ${images.length > 1 ? `

                        <span class="product-image-count">

                            ${images.length} Photos

                        </span>

                    ` : ""}

                </div>


                <div class="product-info">

                    <span class="product-category">

                        ${escapeHTML(categoryLabel || "Collection")}

                    </span>


                    <h3>${escapeHTML(product.name)}</h3>


                    <p class="product-description">

                        ${escapeHTML(product.description || "Explore this beautiful collection.")}

                    </p>


                    <div class="product-action">

                        <span>View Details</span>

                        <span>→</span>

                    </div>

                </div>

            </article>

        `;

    }).join("");


    productGrid.querySelectorAll(".product-card").forEach(card => {

        const open = () => {

            showProductDetails(card.dataset.productId);

        };


        card.addEventListener("click", open);


        card.addEventListener("keydown", event => {

            if (event.key === "Enter" || event.key === " ") {

                event.preventDefault();

                open();

            }

        });

    });

}


/* 14. GALLERY CONTROLS */

function setupGalleryControls() {

    const gallery = document.querySelector(".modal-gallery");

    const mainImage = document.getElementById("modalImage");

    if (!gallery || !mainImage) return;


    if (gallery.querySelector(".gallery-navigation")) return;


    const navigationControls = document.createElement("div");

    navigationControls.className = "gallery-navigation";

    navigationControls.innerHTML = `

        <button

            type="button"

            class="gallery-arrow gallery-prev"

            aria-label="Previous image"

        >‹</button>


        <span class="gallery-counter">1 / 1</span>


        <button

            type="button"

            class="gallery-arrow gallery-next"

            aria-label="Next image"

        >›</button>

    `;


    gallery.appendChild(navigationControls);


    navigationControls.querySelector(".gallery-prev")

        .addEventListener("click", event => {

            event.stopPropagation();

            changeGalleryImage(-1);

        });


    navigationControls.querySelector(".gallery-next")

        .addEventListener("click", event => {

            event.stopPropagation();

            changeGalleryImage(1);

        });

}


function updateGallery() {

    const mainImage = document.getElementById("modalImage");

    const thumbnails = document.getElementById("modalThumbnails");

    const counter = document.querySelector(".gallery-counter");

    const navigationControls = document.querySelector(".gallery-navigation");


    if (!mainImage || !thumbnails) return;


    const total = currentGalleryImages.length;


    if (!total) {

        mainImage.src = CATEGORY_IMAGES.default;

        thumbnails.innerHTML = "";

        if (navigationControls) navigationControls.hidden = true;

        return;

    }


    currentGalleryIndex =

        (currentGalleryIndex + total) % total;


    mainImage.src = currentGalleryImages[currentGalleryIndex];


    if (counter) {

        counter.textContent = `${currentGalleryIndex + 1} / ${total}`;

    }


    if (navigationControls) {

        navigationControls.hidden = total <= 1;

    }


    thumbnails.querySelectorAll("img").forEach((thumbnail, index) => {

        thumbnail.classList.toggle(

            "active",

            index === currentGalleryIndex

        );

    });

}


function changeGalleryImage(direction) {

    if (currentGalleryImages.length <= 1) return;


    currentGalleryIndex += direction;


    if (currentGalleryIndex < 0) {

        currentGalleryIndex = currentGalleryImages.length - 1;

    }


    if (currentGalleryIndex >= currentGalleryImages.length) {

        currentGalleryIndex = 0;

    }


    updateGallery();

}


/* 15. PRODUCT DETAILS */

function showProductDetails(productId) {

    const product = allProducts.find(

        item => String(item.id) === String(productId)

    );


    if (!product) return;


    const images = getProductImages(product);


    const category = getProductCategory(product);

    const subcategory = getProductSubcategory(product);


    const mainImage = document.getElementById("modalImage");

    const thumbnails = document.getElementById("modalThumbnails");


    const name = document.getElementById("modalName");

    const categoryName = document.getElementById("modalCategory");

    const description = document.getElementById("modalDescription");


    if (!mainImage || !thumbnails || !name || !categoryName || !description) {

        console.error("Product modal elements are missing.");

        return;

    }


    currentGalleryImages = images.length

        ? images

        : [CATEGORY_IMAGES.default];


    currentGalleryIndex = 0;


    name.textContent = product.name;


    categoryName.textContent = [

        getCategoryName(category),

        subcategory?.name

    ].filter(Boolean).join(" · ");


    description.textContent =

        product.description ||

        "Discover this beautiful product at Krishna Handloom.";


    /* PRODUCT THUMBNAILS */

    thumbnails.innerHTML = images.map((image, index) => `

        <img

            src="${escapeHTML(image)}"

            alt="${escapeHTML(product.name)} image ${index + 1}"

            class="${index === 0 ? "active" : ""}"

            data-image-index="${index}"

            loading="lazy"

        >

    `).join("");


    thumbnails.querySelectorAll("img").forEach(thumbnail => {

        thumbnail.addEventListener("click", () => {

            currentGalleryIndex = Number(thumbnail.dataset.imageIndex);

            updateGallery();

        });

    });


    setupGalleryControls();

    updateGallery();


    /* WHATSAPP ENQUIRY */

    const message = [

        "Hello! Is this product available?",

        "",

        `Product: ${product.name}`,

        `Category: ${getCategoryName(category)}`,

        `Subcategory: ${subcategory?.name || "Not specified"}`,

        "",

        `Product link: ${getProductLink(product)}`

    ].join("\n");


    const whatsappLink = getWhatsAppLink(message);


    const whatsappButton = document.getElementById("modalWhatsapp");


    if (whatsappButton && whatsappLink) {

        whatsappButton.href = whatsappLink;

        whatsappButton.target = "_blank";

        whatsappButton.rel = "noopener noreferrer";

        whatsappButton.style.display = "inline-flex";

    } else if (whatsappButton) {

        whatsappButton.removeAttribute("href");

        whatsappButton.style.display = "none";

    }


    /* OPEN PRODUCT MODAL */

    if (productModal) {

        productModal.hidden = false;

        document.body.style.overflow = "hidden";

    }

}


/* 16. OPEN PRODUCT FROM SHARED LINK */

function openProductFromURL() {

    const productId = new URLSearchParams(

        window.location.search

    ).get("product");


    if (!productId) return;


    const product = allProducts.find(

        item => String(item.id) === String(productId)

    );


    if (product) {

        showProductDetails(productId);

    }

}


/* 17. CLOSE PRODUCT MODAL */

function closeProductModal() {

    if (!productModal) return;


    productModal.hidden = true;

    document.body.style.overflow = "";

}


modalClose?.addEventListener("click", closeProductModal);


productModal?.addEventListener("click", event => {

    if (event.target === productModal) {

        closeProductModal();

    }

});


document.addEventListener("keydown", event => {

    if (!productModal || productModal.hidden) return;


    if (event.key === "Escape") {

        closeProductModal();

    }


    if (event.key === "ArrowRight") {

        changeGalleryImage(1);

    }


    if (event.key === "ArrowLeft") {

        changeGalleryImage(-1);

    }

});


/* 18. SEARCH */

searchInput?.addEventListener("input", event => {

    searchQuery = event.target.value.trim().toLowerCase();

    renderProducts();

});


/* 19. CATEGORY DROPDOWN */

categoryFilter?.addEventListener("change", event => {

    activeCategory = event.target.value;

    activeSubcategory = "all";


    renderSubcategoryFilter();

    renderProducts();

});


/* 20. RESET FILTERS */

document.getElementById("resetFilters")?.addEventListener("click", () => {

    activeCategory = "all";

    activeSubcategory = "all";

    searchQuery = "";


    if (searchInput) {

        searchInput.value = "";

    }


    if (categoryFilter) {

        categoryFilter.value = "all";

    }


    const subcategoryFilter = document.getElementById("subcategoryFilter");

    if (subcategoryFilter) {

        subcategoryFilter.value = "all";

    }


    renderSubcategoryFilter();

    renderProducts();

});


/* 21. MOBILE NAVIGATION */

menuToggle?.addEventListener("click", () => {

    if (!navigation) return;


    navigation.classList.toggle("active");


    menuToggle.setAttribute(

        "aria-expanded",

        navigation.classList.contains("active")

    );

});


navigation?.querySelectorAll("a").forEach(link => {

    link.addEventListener("click", () => {

        navigation.classList.remove("active");


        menuToggle?.setAttribute(

            "aria-expanded",

            "false"

        );

    });

});


/* 22. GENERAL WHATSAPP */

const generalWhatsapp = document.getElementById("generalWhatsapp");


const generalMessage =

    "Hello Krishna Handloom! I would like to know more about your collection.";


const generalLink = getWhatsAppLink(generalMessage);


if (generalWhatsapp && generalLink) {

    generalWhatsapp.href = generalLink;

    generalWhatsapp.target = "_blank";

    generalWhatsapp.rel = "noopener noreferrer";

}


/* 23. FOOTER YEAR */

const currentYear = document.getElementById("currentYear");


if (currentYear) {

    currentYear.textContent = new Date().getFullYear();

}


/* 24. START WEBSITE */

let websiteLoadStarted = false;


function startWebsite() {

    if (websiteLoadStarted) return;


    websiteLoadStarted = true;


    loadWebsiteData();

}


document.addEventListener("DOMContentLoaded", startWebsite);


if (document.readyState !== "loading") {

    startWebsite();

}

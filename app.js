
/* ==========================================
   THE KRISHNA HANDLOOM
   Main Application JavaScript
========================================== */


/* 1. CONFIGURATION */

const WHATSAPP_NUMBER = "917710372235";


/* 2. GLOBAL STATE */

let allProducts = [];
let allCategories = [];
let activeCategory = "all";
let searchQuery = "";


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


/* ==========================================
   6. PRODUCT IMAGE + WHATSAPP SHARING
========================================== */

async function shareProductEnquiry(product, message, imageUrl, fallbackLink) {

    try {

        // Check browser sharing support

        if (
            !navigator.share ||
            !navigator.canShare ||
            !window.File
        ) {

            window.location.href = fallbackLink;

            return;

        }


        // Fetch actual product image

        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error("Unable to fetch product image.");
        }

        const blob = await response.blob();

        if (!blob.type.startsWith("image/")) {
            throw new Error("Product file is not an image.");
        }


        // Create image attachment

        const extension =
            blob.type.split("/")[1].split("+")[0] || "jpg";

        const fileName =
            `${String(product.name || "product")
                .replace(/[^a-z0-9]/gi, "-")
                .toLowerCase()}.${extension}`;

        const imageFile = new File(
            [blob],
            fileName,
            {
                type: blob.type
            }
        );


        // Prepare sharing information

        const shareData = {

            files: [imageFile],

            title: product.name,

            text: message

        };


        // Check file sharing support

        if (!navigator.canShare({ files: [imageFile] })) {

            window.location.href = fallbackLink;

            return;

        }


        // Open native sharing menu

        await navigator.share(shareData);


    } catch (error) {

        // Customer cancelled sharing

        if (error.name === "AbortError") {
            return;
        }


        console.error("Product sharing error:", error);


        // Fallback to normal WhatsApp message

        window.location.href = fallbackLink;

    }

}


/* 7. LOAD DATA FROM SUPABASE */

async function loadWebsiteData() {

    try {

        if (!window.supabaseClient) {

            throw new Error("Supabase connection is not configured.");

        }

        const [categoryResult, productResult] = await Promise.all([

            window.supabaseClient
                .from("categories")
                .select("*")
                .order("name"),

            window.supabaseClient
                .from("products")
                .select("*")
                .order("created_at", { ascending: false })

        ]);


        if (categoryResult.error) {
            throw categoryResult.error;
        }

        if (productResult.error) {
            throw productResult.error;
        }


        allCategories = categoryResult.data || [];

        allProducts = productResult.data || [];


        renderCategories();

        renderCategoryFilter();

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
            CATEGORY_IMAGES[name.toLowerCase()] ||
            CATEGORY_IMAGES.default;


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


/* 10. CATEGORY SELECTION */

function selectCategory(categoryId) {

    activeCategory = String(categoryId);


    if (categoryFilter) {

        categoryFilter.value = activeCategory;

    }


    renderProducts();


    document.getElementById("products")?.scrollIntoView({

        behavior: "smooth"

    });

}


/* 11. PRODUCT FILTERING */

function getFilteredProducts() {

    return allProducts.filter(product => {

        const matchesCategory =

            activeCategory === "all" ||

            String(product.category_id) === activeCategory;


        const name = String(product.name || "").toLowerCase();


        const description = String(
            product.description || ""
        ).toLowerCase();


        const category = allCategories.find(

            item => String(item.id) === String(product.category_id)

        );


        const categoryName = getCategoryName(category).toLowerCase();


        const matchesSearch =

            name.includes(searchQuery) ||

            description.includes(searchQuery) ||

            categoryName.includes(searchQuery);


        return matchesCategory && matchesSearch;

    });

}


/* 12. PRODUCT GRID */

function renderProducts() {

    if (!productGrid) return;


    const filteredProducts = getFilteredProducts();


    const selectedCategory = allCategories.find(

        category => String(category.id) === activeCategory

    );


    if (activeFilter) {

        activeFilter.textContent =

            activeCategory === "all"

                ? `Showing ${filteredProducts.length} products`

                : `Showing ${getCategoryName(selectedCategory)} · ${filteredProducts.length} products`;

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


        const category = allCategories.find(

            item => String(item.id) === String(product.category_id)

        );


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

                </div>


                <div class="product-info">

                    <span class="product-category">

                        ${escapeHTML(getCategoryName(category))}

                    </span>


                    <h3>${escapeHTML(product.name)}</h3>


                    <p>

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


/* ==========================================
   13. PRODUCT DETAILS + WHATSAPP ENQUIRY
========================================== */

function showProductDetails(productId) {

    const product = allProducts.find(

        item => String(item.id) === String(productId)

    );


    if (!product) return;


    const images = getProductImages(product);


    const category = allCategories.find(

        item => String(item.id) === String(product.category_id)

    );


    const mainImage = document.getElementById("modalImage");

    const thumbnails = document.getElementById("modalThumbnails");


    const name = document.getElementById("modalName");

    const categoryName = document.getElementById("modalCategory");

    const description = document.getElementById("modalDescription");


    mainImage.src = images[0] || CATEGORY_IMAGES.default;

    mainImage.alt = product.name;


    name.textContent = product.name;

    categoryName.textContent = getCategoryName(category);


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

        >

    `).join("");


    thumbnails.querySelectorAll("img").forEach(thumbnail => {

        thumbnail.addEventListener("click", () => {

            mainImage.src = images[Number(thumbnail.dataset.imageIndex)];


            thumbnails.querySelectorAll("img").forEach(img => {

                img.classList.remove("active");

            });


            thumbnail.classList.add("active");

        });

    });


    /* WHATSAPP MESSAGE */

    const message = [

        "Hello! Is this product available?",

        "",

        `Product: ${product.name}`,

        "",

        `Category: ${getCategoryName(category)}`,

        `Product link: ${getProductLink(product)}`

    ].join("\n");


    const whatsappLink = getWhatsAppLink(message);


    const whatsappButton = document.getElementById("modalWhatsapp");


    if (whatsappLink) {

        whatsappButton.href = whatsappLink;


        whatsappButton.onclick = async function(event) {

            event.preventDefault();


            await shareProductEnquiry(

                product,

                message,

                images[0] || CATEGORY_IMAGES.default,

                whatsappLink

            );

        };


        whatsappButton.style.display = "inline-flex";


    } else {

        whatsappButton.removeAttribute("href");

        whatsappButton.onclick = null;

        whatsappButton.style.display = "none";

    }


    /* OPEN MODAL */

    productModal.hidden = false;

    document.body.style.overflow = "hidden";

}


/* 14. OPEN PRODUCT FROM SHARED LINK */

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


/* 15. CLOSE PRODUCT MODAL */

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

    if (

        event.key === "Escape" &&

        productModal &&

        !productModal.hidden

    ) {

        closeProductModal();

    }

});


/* 16. SEARCH */

searchInput?.addEventListener("input", event => {

    searchQuery = event.target.value.trim().toLowerCase();

    renderProducts();

});


/* 17. CATEGORY DROPDOWN */

categoryFilter?.addEventListener("change", event => {

    activeCategory = event.target.value;

    renderProducts();

});


/* 18. RESET FILTERS */

document.getElementById("resetFilters")?.addEventListener("click", () => {

    activeCategory = "all";

    searchQuery = "";


    if (searchInput) {
        searchInput.value = "";
    }


    if (categoryFilter) {
        categoryFilter.value = "all";
    }


    renderProducts();

});


/* 19. MOBILE NAVIGATION */

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


/* 20. GENERAL WHATSAPP */

const generalWhatsapp = document.getElementById("generalWhatsapp");


const generalMessage =

    "Hello Krishna Handloom! I would like to know more about your collection.";


const generalLink = getWhatsAppLink(generalMessage);


if (generalWhatsapp && generalLink) {

    generalWhatsapp.href = generalLink;

}


/* 21. FOOTER YEAR */

const currentYear = document.getElementById("currentYear");


if (currentYear) {

    currentYear.textContent = new Date().getFullYear();

}


/* 22. START WEBSITE */

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

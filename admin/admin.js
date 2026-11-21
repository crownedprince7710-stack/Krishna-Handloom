
/* ==========================================
   THE KRISHNA HANDLOOM - ADMIN SYSTEM
========================================== */

const ADMIN_UID = "c7479b30-3c69-4a0c-bfe8-c5f18b7ad1d1";
const db = window.supabaseClient;
const BUCKET = "product-images";

const DOMAIN_SETTING_ID = "rs-handloom";

let currentUser = null;
let products = [];
let categories = [];
let existingImages = [];
let selectedFiles = [];
let savedDomainExpiry = null;

const $ = id => document.getElementById(id);

const loginScreen = $("loginScreen");
const dashboardScreen = $("dashboardScreen");
const loginForm = $("loginForm");
const loginMessage = $("loginMessage");
const loginButton = $("loginButton");
const logoutButton = $("logoutButton");
const productList = $("productList");
const categoryList = $("categoryList");
const productModal = $("productModal");
const productForm = $("productForm");
const productImagesInput = $("productImages");
const imagePreview = $("imagePreview");
const productMessage = $("productMessage");

// DOMAIN ELEMENTS

const domainTrigger = $("domainRenewalTrigger");
const domainDaysLeft = $("domainDaysLeft");
const domainModal = $("domainRenewalModal");
const domainExpiryForm = $("domainExpiryForm");
const domainExpiryDate = $("domainExpiryDate");
const domainExpiryMessage = $("domainExpiryMessage");
const saveDomainExpiry = $("saveDomainExpiry");


/* ==========================================
   HELPERS
========================================== */

function showMessage(element, message, type = "error") {
    element.textContent = message;
    element.className = "message " + type;
}

function clearMessage(element) {
    element.textContent = "";
    element.className = "message";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getCategoryName(id) {
    const category = categories.find(item => item.id === id);
    return category ? category.name : "Uncategorised";
}

function getImages(product) {
    return Array.isArray(product.images) ? product.images : [];
}


/* ==========================================
   AUTHENTICATION
========================================== */

async function checkAdmin(user) {
    if (!user || user.id !== ADMIN_UID) {
        await db.auth.signOut();

        currentUser = null;

        loginScreen.classList.remove("hidden");
        dashboardScreen.classList.add("hidden");

        showMessage(
            loginMessage,
            "This account does not have administrator access."
        );

        return false;
    }

    currentUser = user;

    loginScreen.classList.add("hidden");
    dashboardScreen.classList.remove("hidden");

    clearMessage(loginMessage);

    await loadDashboard();

    return true;
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage(loginMessage);

    if (!db) {
        showMessage(
            loginMessage,
            "Supabase is not configured. Check js/supabase.js."
        );
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    try {
        const { data, error } = await db.auth.signInWithPassword({
            email: $("email").value.trim(),
            password: $("password").value
        });

        if (error) throw error;

        await checkAdmin(data.user);

    } catch (error) {
        showMessage(loginMessage, error.message);

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Sign In";
    }
});

logoutButton.addEventListener("click", async () => {
    const { error } = await db.auth.signOut();

    if (error) {
        alert("Unable to sign out: " + error.message);
        return;
    }

    currentUser = null;

    dashboardScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    loginForm.reset();
});


/* ==========================================
   INITIAL SESSION
========================================== */

async function initializeAdmin() {
    if (!db) {
        showMessage(
            loginMessage,
            "Supabase connection missing. Check js/supabase.js."
        );
        return;
    }

    try {
        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        if (data.session) {
            await checkAdmin(data.session.user);
        }

    } catch (error) {
        showMessage(loginMessage, error.message);
    }
}


/* ==========================================
   NAVIGATION
========================================== */

function showSection(section) {
    ["overview", "products", "categories"].forEach(name => {
        $(name + "Section").classList.toggle(
            "hidden",
            name !== section
        );
    });

    document.querySelectorAll(".nav-item").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.section === section
        );
    });

    $("pageTitle").textContent = {
        overview: "Overview",
        products: "Products",
        categories: "Categories"
    }[section];
}

document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        showSection(button.dataset.section);
    });
});

$("goToProducts").addEventListener("click", () => {
    showSection("products");
});


/* ==========================================
   DASHBOARD DATA
========================================== */

async function loadDashboard() {
    await Promise.all([
        loadCategories(),
        loadProducts(),
        loadDomainSettings()
    ]);

    updateStatistics();
}


/* ==========================================
   CATEGORIES
========================================== */

async function loadCategories() {
    const { data, error } = await db
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

    if (error) throw error;

    categories = data || [];

    renderCategories();
    populateCategorySelect();
}

function renderCategories() {
    if (!categories.length) {
        categoryList.innerHTML =
            '<p class="empty-message">No categories created yet.</p>';
        return;
    }

    categoryList.innerHTML = categories.map(category => `
        <div class="category-item">
            <strong>${escapeHTML(category.name)}</strong>

            <button type="button"
                data-delete-category="${escapeHTML(category.id)}">
                Delete
            </button>
        </div>
    `).join("");
}

function populateCategorySelect() {
    $("productCategory").innerHTML =
        '<option value="">Select a category</option>' +
        categories.map(category => `
            <option value="${escapeHTML(category.id)}">
                ${escapeHTML(category.name)}
            </option>
        `).join("");
}

$("categoryForm").addEventListener("submit", async event => {
    event.preventDefault();

    const input = $("categoryName");
    const name = input.value.trim();

    if (!name) return;

    const button = event.submitter;

    button.disabled = true;
    button.textContent = "Adding...";

    try {
        const { error } = await db
            .from("categories")
            .insert({ name });

        if (error) throw error;

        input.value = "";

        await loadCategories();
        updateStatistics();

    } catch (error) {
        alert("Could not add category: " + error.message);

    } finally {
        button.disabled = false;
        button.textContent = "Add Category";
    }
});

categoryList.addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-category]");

    if (!button) return;

    if (!confirm(
        "Delete this category? Products in it will become uncategorised."
    )) {
        return;
    }

    try {
        const { error } = await db
            .from("categories")
            .delete()
            .eq("id", button.dataset.deleteCategory);

        if (error) throw error;

        await loadDashboard();

    } catch (error) {
        alert("Could not delete category: " + error.message);
    }
});


/* ==========================================
   PRODUCTS
========================================== */

async function loadProducts() {
    const { data, error } = await db
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;

    products = data || [];

    renderProducts();
}

function renderProducts() {
    $("productEmpty").classList.toggle(
        "hidden",
        products.length > 0
    );

    if (!products.length) {
        productList.innerHTML = "";
        return;
    }

    productList.innerHTML = products.map(product => {
        const images = getImages(product);

        const image = images[0] ||
            "https://placehold.co/600x400/f0e9df/6b5747?text=No+Image";

        return `
            <article class="admin-product-card">

                <img src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    loading="lazy">

                <div class="admin-product-info">

                    <h3>${escapeHTML(product.name)}</h3>

                    <p>${escapeHTML(
                        getCategoryName(product.category_id)
                    )}</p>

                    <p>${images.length} photo(s)</p>

                    <div class="card-actions">

                        <button type="button"
                            data-edit-product="${escapeHTML(product.id)}">
                            Edit
                        </button>

                        <button type="button"
                            class="delete-button"
                            data-delete-product="${escapeHTML(product.id)}">
                            Delete
                        </button>

                    </div>
                </div>
            </article>
        `;
    }).join("");
}

function updateStatistics() {
    $("totalProducts").textContent = products.length;
    $("totalCategories").textContent = categories.length;
}


/* ==========================================
   PRODUCT MODAL
========================================== */

function openProductModal(product = null) {
    productForm.reset();

    clearMessage(productMessage);

    existingImages = [];
    selectedFiles = [];

    imagePreview.innerHTML = "";

    $("editProductId").value = "";

    if (product) {
        $("productModalTitle").textContent = "Edit Product";

        $("editProductId").value = product.id;
        $("productName").value = product.name;
        $("productDescription").value = product.description || "";
        $("productCategory").value = product.category_id || "";

        existingImages = [...getImages(product)];

        renderImagePreview();

    } else {
        $("productModalTitle").textContent = "Add Product";
    }

    productModal.classList.remove("hidden");
}

function closeProductModal() {
    productModal.classList.add("hidden");

    productForm.reset();

    existingImages = [];
    selectedFiles = [];

    imagePreview.innerHTML = "";
}

$("addProductButton").addEventListener("click", () => {
    openProductModal();
});

$("closeProductModal").addEventListener("click", closeProductModal);

productModal.addEventListener("click", event => {
    if (event.target === productModal) {
        closeProductModal();
    }
});


/* ==========================================
   IMAGE PREVIEW
========================================== */

function renderImagePreview() {
    imagePreview.innerHTML = "";

    existingImages.forEach(url => {
        const img = document.createElement("img");

        img.src = url;
        img.alt = "Existing product photo";

        imagePreview.appendChild(img);
    });

    selectedFiles.forEach(file => {
        const img = document.createElement("img");

        img.alt = "New product photo";
        img.src = URL.createObjectURL(file);

        imagePreview.appendChild(img);
    });
}

productImagesInput.addEventListener("change", () => {
    selectedFiles = Array.from(productImagesInput.files || []);

    const invalidFile = selectedFiles.find(file =>
        !file.type.startsWith("image/") ||
        file.size > 10 * 1024 * 1024
    );

    if (selectedFiles.length > 10 || invalidFile) {
        alert(
            "Select up to 10 image files, each no larger than 10 MB."
        );

        selectedFiles = [];
        productImagesInput.value = "";
    }

    renderImagePreview();
});


/* ==========================================
   STORAGE
========================================== */

async function uploadProductImages(productId) {
    const uploadedURLs = [];

    for (const file of selectedFiles) {
        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        const filePath =
            `${currentUser.id}/${productId}/${crypto.randomUUID()}.${extension}`;

        const { error } = await db.storage
            .from(BUCKET)
            .upload(filePath, file, {
                contentType: file.type,
                upsert: false
            });

        if (error) throw error;

        const { data } = db.storage
            .from(BUCKET)
            .getPublicUrl(filePath);

        uploadedURLs.push(data.publicUrl);
    }

    return uploadedURLs;
}

function getStoragePath(url) {
    if (typeof url !== "string") return null;

    try {
        const parsed = new URL(url);

        const marker =
            "/storage/v1/object/public/" + BUCKET + "/";

        const index = parsed.pathname.indexOf(marker);

        if (index === -1) return null;

        return decodeURIComponent(
            parsed.pathname.slice(index + marker.length)
        );

    } catch {
        return null;
    }
}


/* ==========================================
   SAVE PRODUCT
========================================== */

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage(productMessage);

    const button = $("saveProductButton");

    const productId = $("editProductId").value;
    const name = $("productName").value.trim();
    const description = $("productDescription").value.trim();
    const categoryId = $("productCategory").value;

    if (!name || !categoryId) {
        showMessage(
            productMessage,
            "Please enter a name and select a category."
        );
        return;
    }

    if (!productId && selectedFiles.length === 0) {
        showMessage(
            productMessage,
            "Please select at least one product photo."
        );
        return;
    }

    if (existingImages.length + selectedFiles.length > 10) {
        showMessage(
            productMessage,
            "A product can have a maximum of 10 photos."
        );
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    let uploadedURLs = [];

    try {
        const id = productId || crypto.randomUUID();

        uploadedURLs = await uploadProductImages(id);

        const productData = {
            id,
            name,
            description,
            category_id: categoryId,
            images: [...existingImages, ...uploadedURLs]
        };

        const result = productId
            ? await db.from("products")
                .update(productData)
                .eq("id", productId)
            : await db.from("products")
                .insert(productData);

        if (result.error) throw result.error;

        showMessage(
            productMessage,
            "Product saved successfully!",
            "success"
        );

        await loadDashboard();

        setTimeout(closeProductModal, 700);

    } catch (error) {
        if (uploadedURLs.length) {
            const paths = uploadedURLs
                .map(getStoragePath)
                .filter(Boolean);

            if (paths.length) {
                await db.storage.from(BUCKET).remove(paths);
            }
        }

        showMessage(
            productMessage,
            "Could not save product: " + error.message
        );

    } finally {
        button.disabled = false;
        button.textContent = "Save Product";
    }
});


/* ==========================================
   EDIT AND DELETE PRODUCTS
========================================== */

productList.addEventListener("click", async event => {

    const editButton = event.target.closest("[data-edit-product]");

    const deleteButton = event.target.closest("[data-delete-product]");

    if (editButton) {
        const product = products.find(
            item => item.id === editButton.dataset.editProduct
        );

        if (product) openProductModal(product);

        return;
    }

    if (deleteButton) {
        const product = products.find(
            item => item.id === deleteButton.dataset.deleteProduct
        );

        if (!product) return;

        if (!confirm(
            `Delete "${product.name}" permanently?`
        )) {
            return;
        }

        try {
            const { error } = await db
                .from("products")
                .delete()
                .eq("id", product.id);

            if (error) throw error;

            const paths = getImages(product)
                .map(getStoragePath)
                .filter(Boolean);

            if (paths.length) {
                const { error: storageError } = await db.storage
                    .from(BUCKET)
                    .remove(paths);

                if (storageError) {
                    console.error(
                        "Image cleanup failed:",
                        storageError.message
                    );
                }
            }

            await loadDashboard();

        } catch (error) {
            alert("Could not delete product: " + error.message);
        }
    }
});


/* ==========================================
   DOMAIN RENEWAL SYSTEM
========================================== */

/* LOAD DOMAIN SETTINGS */

async function loadDomainSettings() {
    if (!currentUser || currentUser.id !== ADMIN_UID) return;

    try {
        const { data, error } = await db
            .from("domain_settings")
            .select("expiry_date")
            .eq("id", DOMAIN_SETTING_ID)
            .maybeSingle();

        if (error) throw error;

        savedDomainExpiry = data?.expiry_date || null;

        domainExpiryDate.value = savedDomainExpiry || "";

        updateDomainCountdown();

    } catch (error) {
        console.error("Domain settings error:", error);

        savedDomainExpiry = null;

        domainDaysLeft.textContent = "Unavailable";
    }
}


/* COUNTDOWN CALCULATION */

function updateDomainCountdown() {
    domainTrigger.classList.remove(
        "warning",
        "critical",
        "expired"
    );

    if (!savedDomainExpiry) {
        domainDaysLeft.textContent = "Set expiry";
        return;
    }

    const parts = savedDomainExpiry.split("-").map(Number);

    if (
        parts.length !== 3 ||
        parts.some(number => !Number.isInteger(number)) ||
        parts[0] < 1000 ||
        parts[1] < 1 ||
        parts[1] > 12 ||
        parts[2] < 1 ||
        parts[2] > 31
    ) {
        domainDaysLeft.textContent = "Invalid date";
        return;
    }

    const [year, month, day] = parts;

    const expiry = Date.UTC(year, month - 1, day);

    const now = new Date();

    const today = Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const daysLeft = Math.round(
        (expiry - today) / 86400000
    );

    if (daysLeft < 0) {
        domainDaysLeft.textContent = "Expired";

        domainTrigger.classList.add("expired");
    }

    else if (daysLeft === 0) {
        domainDaysLeft.textContent = "Expires today";

        domainTrigger.classList.add("critical");
    }

    else {
        domainDaysLeft.textContent =
            `${daysLeft} days left`;

        if (daysLeft <= 7) {
            domainTrigger.classList.add("critical");
        }

        else if (daysLeft <= 30) {
            domainTrigger.classList.add("warning");
        }
    }
}


/* OPEN DOMAIN SETTINGS */

domainTrigger.addEventListener("click", () => {

    if (!currentUser || currentUser.id !== ADMIN_UID) return;

    clearMessage(domainExpiryMessage);

    domainExpiryDate.value = savedDomainExpiry || "";

    domainModal.classList.remove("hidden");
});


/* CLOSE DOMAIN SETTINGS */

function closeDomainModal() {
    domainModal.classList.add("hidden");

    clearMessage(domainExpiryMessage);
}

$("closeDomainModal").addEventListener(
    "click",
    closeDomainModal
);

domainModal.addEventListener("click", event => {
    if (event.target === domainModal) {
        closeDomainModal();
    }
});

document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        !domainModal.classList.contains("hidden")
    ) {
        closeDomainModal();
    }
});


/* SAVE DOMAIN EXPIRY DATE */

domainExpiryForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage(domainExpiryMessage);

    if (!currentUser || currentUser.id !== ADMIN_UID) {
        showMessage(
            domainExpiryMessage,
            "You are not authorized to change this setting."
        );

        return;
    }

    const expiryDate = domainExpiryDate.value;

    if (!expiryDate) {
        showMessage(
            domainExpiryMessage,
            "Please select an expiry date."
        );

        return;
    }

    saveDomainExpiry.disabled = true;
    saveDomainExpiry.textContent = "Saving...";

    try {
        const { data: existing, error: fetchError } = await db
            .from("domain_settings")
            .select("id")
            .eq("id", DOMAIN_SETTING_ID)
            .maybeSingle();

        if (fetchError) throw fetchError;

        let result;

        if (existing) {

            result = await db
                .from("domain_settings")
                .update({
                    expiry_date: expiryDate,
                    updated_at: new Date().toISOString()
                })
                .eq("id", DOMAIN_SETTING_ID);

        } else {

            result = await db
                .from("domain_settings")
                .insert({
                    id: DOMAIN_SETTING_ID,
                    expiry_date: expiryDate
                });

        }

        if (result.error) throw result.error;

        savedDomainExpiry = expiryDate;

        updateDomainCountdown();

        showMessage(
            domainExpiryMessage,
            "Domain expiry date saved successfully!",
            "success"
        );

        setTimeout(() => {
            closeDomainModal();
        }, 1000);

    } catch (error) {
        console.error("Domain save error:", error);

        showMessage(
            domainExpiryMessage,
            "Could not save expiry date: " + error.message
        );

    } finally {
        saveDomainExpiry.disabled = false;
        saveDomainExpiry.textContent = "Save Expiry Date";
    }
});


/* AUTOMATIC COUNTDOWN REFRESH */

setInterval(() => {
    if (currentUser && currentUser.id === ADMIN_UID) {
        updateDomainCountdown();
    }
}, 60000);


/* ==========================================
   START ADMIN SYSTEM
========================================== */

initializeAdmin();

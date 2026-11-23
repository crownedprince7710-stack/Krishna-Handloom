
/* ==========================================
   THE KRISHNA HANDLOOM - ADMIN SYSTEM
   UPGRADED VERSION
========================================== */

const ADMIN_UID = "66e70835-be34-48c3-8198-67889c62e779"
"0889af88-3bdd-45d3-95a3-e32ba8ca2053";
const db = window.supabaseClient;
const BUCKET = "product-images";
const DOMAIN_SETTING_ID = "rs-decor";

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

let currentUser = null;
let products = [];
let categories = [];
let subcategories = [];

let existingImages = [];
let selectedFiles = [];
let savedDomainExpiry = null;
let previewURLs = [];

const $ = id => document.getElementById(id);

/* ==========================================
   DOM ELEMENTS
========================================== */

const loginScreen = $("loginScreen");
const dashboardScreen = $("dashboardScreen");
const loginForm = $("loginForm");
const loginMessage = $("loginMessage");
const loginButton = $("loginButton");
const logoutButton = $("logoutButton");

const productList = $("productList");
const categoryList = $("categoryList");
const subcategoryList = $("subcategoryList");

const productModal = $("productModal");
const productForm = $("productForm");
const productImagesInput = $("productImages");
const imagePreview = $("imagePreview");

const addMoreImagesButton = $("addMoreImagesButton");

const productMessage = $("productMessage");

const productCategory = $("productCategory");
const productSubcategory = $("productSubcategory");

const subcategoryCategory = $("subcategoryCategory");
const subcategoryName = $("subcategoryName");
const subcategoryMessage = $("subcategoryMessage");

/* DOMAIN ELEMENTS */

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
    if (!element) return;

    element.textContent = message;
    element.className = "message " + type;
}

function clearMessage(element) {
    if (!element) return;

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

function getSubcategoryName(id) {
    const item = subcategories.find(sub => sub.id === id);
    return item ? item.name : "";
}

function getImages(product) {
    return Array.isArray(product?.images) ? product.images : [];
}

function isAdmin() {
    return Boolean(currentUser && currentUser.id === ADMIN_UID);
}

function revokePreviewURLs() {
    previewURLs.forEach(url => URL.revokeObjectURL(url));
    previewURLs = [];
}

function resetImageState() {
    revokePreviewURLs();

    existingImages = [];
    selectedFiles = [];

    productImagesInput.value = "";

    imagePreview.innerHTML = "";

    $("imageSelectionHint").textContent =
        "No new photos selected.";
}

function totalImageCount() {
    return existingImages.length + selectedFiles.length;
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

    try {
        await loadDashboard();
    } catch (error) {
        console.error("Dashboard loading error:", error);
        alert("Dashboard could not load: " + error.message);
    }

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
   DASHBOARD
========================================== */

async function loadDashboard() {
    await loadCategories();
    await loadSubcategories();
    await loadProducts();
    await loadDomainSettings();

    updateStatistics();
}

function updateStatistics() {
    $("totalProducts").textContent = products.length;
    $("totalCategories").textContent = categories.length;
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
    populateCategorySelects();
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

function populateCategorySelects() {
    const options = categories.map(category => `
        <option value="${escapeHTML(category.id)}">
            ${escapeHTML(category.name)}
        </option>
    `).join("");

    productCategory.innerHTML =
        '<option value="">Select a category</option>' + options;

    subcategoryCategory.innerHTML =
        '<option value="">Choose a category</option>' + options;
}

$("categoryForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!isAdmin()) return;

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
        await loadSubcategories();

        updateStatistics();

    } catch (error) {
        alert("Could not add category: " + error.message);

    } finally {
        button.disabled = false;
        button.textContent = "+ Add Category";
    }
});

categoryList.addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-category]");

    if (!button || !isAdmin()) return;

    const categoryId = button.dataset.deleteCategory;

    if (!confirm(
        "Delete this category? Its subcategories will also be deleted."
    )) return;

    try {
        const { error } = await db
            .from("categories")
            .delete()
            .eq("id", categoryId);

        if (error) throw error;

        await loadCategories();
        await loadSubcategories();
        await loadProducts();

        updateStatistics();

    } catch (error) {
        alert("Could not delete category: " + error.message);
    }
});


/* ==========================================
   SUBCATEGORY MANAGEMENT
========================================== */

async function loadSubcategories() {
    const { data, error } = await db
        .from("subcategories")
        .select("*")
        .order("name", { ascending: true });

    if (error) throw error;

    subcategories = data || [];

    renderSubcategories();
    populateProductSubcategories();
}

function renderSubcategories() {
    $("subcategoryEmpty").classList.toggle(
        "hidden",
        subcategories.length > 0
    );

    if (!subcategories.length) {
        subcategoryList.innerHTML = "";
        return;
    }

    subcategoryList.innerHTML = subcategories.map(item => `
        <div class="category-item subcategory-item">
            <div>
                <strong>${escapeHTML(item.name)}</strong>
                <small>
                    Under ${escapeHTML(getCategoryName(item.category_id))}
                </small>
            </div>

            <button type="button"
                data-delete-subcategory="${escapeHTML(item.id)}">
                Delete
            </button>
        </div>
    `).join("");
}

function populateProductSubcategories(selectedId = "") {
    const categoryId = productCategory.value;

    const matching = subcategories.filter(
        item => item.category_id === categoryId
    );

    productSubcategory.innerHTML =
        '<option value="">Select a subcategory (optional)</option>' +
        matching.map(item => `
            <option value="${escapeHTML(item.id)}">
                ${escapeHTML(item.name)}
            </option>
        `).join("");

    productSubcategory.disabled = !categoryId || !matching.length;

    if (selectedId && matching.some(item => item.id === selectedId)) {
        productSubcategory.value = selectedId;
    }
}

productCategory.addEventListener("change", () => {
    populateProductSubcategories();
});

$("subcategoryForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!isAdmin()) return;

    clearMessage(subcategoryMessage);

    const categoryId = subcategoryCategory.value;
    const name = subcategoryName.value.trim();

    if (!categoryId || !name) {
        showMessage(
            subcategoryMessage,
            "Select a category and enter a subcategory name."
        );
        return;
    }

    const button = event.submitter;

    button.disabled = true;
    button.textContent = "Adding...";

    try {
        const { error } = await db
            .from("subcategories")
            .insert({
                category_id: categoryId,
                name
            });

        if (error) throw error;

        subcategoryName.value = "";

        await loadSubcategories();

        subcategoryCategory.value = categoryId;

        showMessage(
            subcategoryMessage,
            "Subcategory added successfully!",
            "success"
        );

    } catch (error) {
        showMessage(
            subcategoryMessage,
            "Could not add subcategory: " + error.message
        );

    } finally {
        button.disabled = false;
        button.textContent = "+ Add Subcategory";
    }
});

subcategoryList.addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-subcategory]");

    if (!button || !isAdmin()) return;

    const subcategoryId = button.dataset.deleteSubcategory;

    if (!confirm(
        "Delete this subcategory? Products using it will remain, but lose this subcategory."
    )) return;

    try {
        const { error } = await db
            .from("subcategories")
            .delete()
            .eq("id", subcategoryId);

        if (error) throw error;

        await loadSubcategories();
        await loadProducts();

    } catch (error) {
        alert("Could not delete subcategory: " + error.message);
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

        const categoryName = getCategoryName(product.category_id);
        const subcategoryName = getSubcategoryName(product.subcategory_id);

        return `
            <article class="admin-product-card">

                <img src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    loading="lazy">

                <div class="admin-product-info">

                    <h3>${escapeHTML(product.name)}</h3>

                    <p>${escapeHTML(categoryName)}</p>

                    ${subcategoryName
                        ? `<p>${escapeHTML(subcategoryName)}</p>`
                        : ""}

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


/* ==========================================
   PRODUCT MODAL
========================================== */

async function openProductModal(product = null) {
    productForm.reset();

    clearMessage(productMessage);
    resetImageState();

    $("editProductId").value = "";

    if (product) {
        $("productModalTitle").textContent = "Edit Product";

        $("editProductId").value = product.id;
        $("productName").value = product.name;
        $("productDescription").value = product.description || "";

        productCategory.value = product.category_id || "";

        existingImages = [...getImages(product)];

        populateProductSubcategories(product.subcategory_id || "");

    } else {
        $("productModalTitle").textContent = "Add Product";

        productSubcategory.innerHTML =
            '<option value="">Select a category first</option>';

        productSubcategory.disabled = true;
    }

    renderImagePreview();

    productModal.classList.remove("hidden");
}

function closeProductModal() {
    productModal.classList.add("hidden");

    productForm.reset();

    resetImageState();

    $("editProductId").value = "";

    productSubcategory.innerHTML =
        '<option value="">Select a category first</option>';

    productSubcategory.disabled = true;

    clearMessage(productMessage);
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
   MULTIPLE IMAGE UPLOAD
========================================== */

function addImageFiles(files) {
    const incoming = Array.from(files || []);

    if (!incoming.length) return;

    for (const file of incoming) {
        if (!file.type.startsWith("image/")) {
            alert(`${file.name} is not a valid image.`);
            continue;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            alert(`${file.name} exceeds the 10 MB limit.`);
            continue;
        }

        if (totalImageCount() >= MAX_IMAGES) {
            alert(`Maximum ${MAX_IMAGES} photos per product.`);
            break;
        }

        selectedFiles.push(file);
    }

    productImagesInput.value = "";

    renderImagePreview();
}

productImagesInput.addEventListener("change", () => {
    addImageFiles(productImagesInput.files);
});

addMoreImagesButton.addEventListener("click", () => {
    if (totalImageCount() >= MAX_IMAGES) {
        alert(`Maximum ${MAX_IMAGES} photos per product.`);
        return;
    }

    productImagesInput.click();
});

function renderImagePreview() {
    revokePreviewURLs();

    imagePreview.innerHTML = "";

    const allItems = [
        ...existingImages.map((url, index) => ({
            type: "existing",
            value: url,
            index
        })),
        ...selectedFiles.map((file, index) => ({
            type: "new",
            value: file,
            index
        }))
    ];

    allItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "image-preview-item";

        const img = document.createElement("img");

        if (item.type === "existing") {
            img.src = item.value;
        } else {
            const url = URL.createObjectURL(item.value);
            previewURLs.push(url);
            img.src = url;
        }

        img.alt = "Product photograph";

        const removeButton = document.createElement("button");

        removeButton.type = "button";
        removeButton.className = "image-remove-button";
        removeButton.textContent = "×";
        removeButton.title = "Remove photo";

        removeButton.dataset.imageType = item.type;
        removeButton.dataset.imageIndex = item.index;

        card.append(img, removeButton);

        imagePreview.appendChild(card);
    });

    // Add individual plus card
    if (totalImageCount() < MAX_IMAGES) {
        const addCard = document.createElement("button");

        addCard.type = "button";
        addCard.className = "image-add-card";
        addCard.innerHTML = `
            <span>+</span>
            <small>Add photo</small>
        `;

        addCard.addEventListener("click", () => {
            productImagesInput.click();
        });

        imagePreview.appendChild(addCard);
    }

    $("imageSelectionHint").textContent =
        `${existingImages.length} saved photo(s), ` +
        `${selectedFiles.length} new photo(s). ` +
        `${totalImageCount()} / ${MAX_IMAGES} total.`;
}

imagePreview.addEventListener("click", event => {
    const button = event.target.closest("[data-image-type]");

    if (!button) return;

    const index = Number(button.dataset.imageIndex);

    if (button.dataset.imageType === "existing") {
        existingImages.splice(index, 1);
    } else {
        selectedFiles.splice(index, 1);
    }

    renderImagePreview();
});


/* ==========================================
   SUPABASE STORAGE
========================================== */

async function uploadProductImages(productId) {
    const uploadedURLs = [];
    const uploadedPaths = [];

    for (const file of selectedFiles) {
        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "jpg";

        const filePath =
            `${currentUser.id}/${productId}/${crypto.randomUUID()}.${extension}`;

        const { error } = await db.storage
            .from(BUCKET)
            .upload(filePath, file, {
                contentType: file.type,
                upsert: false
            });

        if (error) {
            if (uploadedPaths.length) {
                await db.storage.from(BUCKET).remove(uploadedPaths);
            }

            throw error;
        }

        uploadedPaths.push(filePath);

        const { data } = db.storage
            .from(BUCKET)
            .getPublicUrl(filePath);

        uploadedURLs.push(data.publicUrl);
    }

    return {
        urls: uploadedURLs,
        paths: uploadedPaths
    };
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

async function removeStorageImages(urls) {
    const paths = urls.map(getStoragePath).filter(Boolean);

    if (!paths.length) return;

    const { error } = await db.storage
        .from(BUCKET)
        .remove(paths);

    if (error) {
        console.error("Storage cleanup error:", error.message);
    }
}


/* ==========================================
   SAVE PRODUCT
========================================== */

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage(productMessage);

    if (!isAdmin()) {
        showMessage(productMessage, "Administrator access required.");
        return;
    }

    const button = $("saveProductButton");

    const productId = $("editProductId").value;
    const name = $("productName").value.trim();
    const description = $("productDescription").value.trim();
    const categoryId = productCategory.value;
    const subcategoryId = productSubcategory.value || null;

    if (!name || !categoryId) {
        showMessage(
            productMessage,
            "Please enter a name and select a category."
        );
        return;
    }

    if (subcategoryId) {
        const validSubcategory = subcategories.some(item =>
            item.id === subcategoryId &&
            item.category_id === categoryId
        );

        if (!validSubcategory) {
            showMessage(
                productMessage,
                "Please select a valid subcategory."
            );
            return;
        }
    }

    if (!productId && totalImageCount() === 0) {
        showMessage(
            productMessage,
            "Please select at least one product photo."
        );
        return;
    }

    if (totalImageCount() > MAX_IMAGES) {
        showMessage(
            productMessage,
            `Maximum ${MAX_IMAGES} photos allowed.`
        );
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    let uploaded = { urls: [], paths: [] };

    try {
        const id = productId || crypto.randomUUID();

        uploaded = await uploadProductImages(id);

        const productData = {
            name,
            description,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            images: [...existingImages, ...uploaded.urls]
        };

        let result;

        if (productId) {
            result = await db
                .from("products")
                .update(productData)
                .eq("id", productId);

        } else {
            result = await db
                .from("products")
                .insert({
                    id,
                    ...productData
                });
        }

        if (result.error) throw result.error;

        // Remove photos intentionally removed by the owner
        if (productId) {
            const originalProduct = products.find(
                item => item.id === productId
            );

            const originalImages = getImages(originalProduct);

            const removedImages = originalImages.filter(
                url => !existingImages.includes(url)
            );

            await removeStorageImages(removedImages);
        }

        showMessage(
            productMessage,
            "Product saved successfully!",
            "success"
        );

        await loadProducts();
        updateStatistics();

        setTimeout(closeProductModal, 700);

    } catch (error) {
        if (uploaded.urls.length) {
            await removeStorageImages(uploaded.urls);
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

        if (product) await openProductModal(product);

        return;
    }

    if (deleteButton) {
        if (!isAdmin()) return;

        const product = products.find(
            item => item.id === deleteButton.dataset.deleteProduct
        );

        if (!product) return;

        if (!confirm(`Delete "${product.name}" permanently?`)) return;

        try {
            const { error } = await db
                .from("products")
                .delete()
                .eq("id", product.id);

            if (error) throw error;

            await removeStorageImages(getImages(product));

            await loadProducts();
            updateStatistics();

        } catch (error) {
            alert("Could not delete product: " + error.message);
        }
    }
});


/* ==========================================
   DOMAIN RENEWAL SYSTEM
========================================== */

async function loadDomainSettings() {
    if (!isAdmin()) return;

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

    } else if (daysLeft === 0) {
        domainDaysLeft.textContent = "Expires today";
        domainTrigger.classList.add("critical");

    } else {
        domainDaysLeft.textContent = `${daysLeft} days left`;

        if (daysLeft <= 7) {
            domainTrigger.classList.add("critical");
        } else if (daysLeft <= 30) {
            domainTrigger.classList.add("warning");
        }
    }
}

domainTrigger.addEventListener("click", () => {
    if (!isAdmin()) return;

    clearMessage(domainExpiryMessage);

    domainExpiryDate.value = savedDomainExpiry || "";

    domainModal.classList.remove("hidden");
});

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

    if (
        event.key === "Escape" &&
        !productModal.classList.contains("hidden")
    ) {
        closeProductModal();
    }
});

domainExpiryForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage(domainExpiryMessage);

    if (!isAdmin()) {
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

        setTimeout(closeDomainModal, 1000);

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


/* ==========================================
   AUTOMATIC COUNTDOWN REFRESH
========================================== */

setInterval(() => {
    if (isAdmin()) {
        updateDomainCountdown();
    }
}, 60000);


/* ==========================================
   START ADMIN SYSTEM
========================================== */

initializeAdmin();

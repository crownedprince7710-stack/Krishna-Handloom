
/* ==========================================
   THE KRISHNA HANDLOOM - ADMIN SYSTEM
========================================== */

const ADMIN_UID = "c7479b30-3c69-4a0c-bfe8-c5f18b7ad1d1";

const supabaseClient = window.supabaseClient;
const BUCKET = "product-images";

let currentUser = null;
let products = [];
let categories = [];
let existingImages = [];
let selectedFiles = [];

/* ==========================================
   ELEMENTS
========================================== */

const $ = (id) => document.getElementById(id);

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
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getCategoryName(categoryId) {
    const category = categories.find(
        item => item.id === categoryId
    );

    return category ? category.name : "Uncategorised";
}

function getImages(product) {
    return Array.isArray(product.images)
        ? product.images
        : [];
}

/* ==========================================
   AUTHENTICATION
========================================== */

async function checkAdmin(user) {
    if (!user || user.id !== ADMIN_UID) {
        await supabaseClient.auth.signOut();

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

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearMessage(loginMessage);

    if (!supabaseClient) {
        showMessage(
            loginMessage,
            "Supabase is not configured. Check js/supabase.js."
        );
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    try {
        const email = $("email").value.trim();
        const password = $("password").value;

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        if (data.user.id !== ADMIN_UID) {
            await supabaseClient.auth.signOut();

            throw new Error(
                "This account is not authorised to access the dashboard."
            );
        }

        await checkAdmin(data.user);

    } catch (error) {
        showMessage(loginMessage, error.message);
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Sign In";
    }
});

logoutButton.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();

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
   INITIAL SESSION CHECK
========================================== */

async function initializeAdmin() {
    if (!supabaseClient) {
        showMessage(
            loginMessage,
            "Supabase connection missing. Check your configuration."
        );
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();

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
    const sections = [
        "overview",
        "products",
        "categories"
    ];

    sections.forEach(name => {
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

    const titles = {
        overview: "Overview",
        products: "Products",
        categories: "Categories"
    };

    $("pageTitle").textContent = titles[section];
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
   LOAD DASHBOARD
========================================== */

async function loadDashboard() {
    await Promise.all([
        loadCategories(),
        loadProducts()
    ]);

    updateStatistics();
}

/* ==========================================
   CATEGORIES
========================================== */

async function loadCategories() {
    const { data, error } = await supabaseClient
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

    if (error) {
        throw error;
    }

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

            <button
                type="button"
                data-delete-category="${escapeHTML(category.id)}"
            >
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

$("categoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = $("categoryName");
    const name = input.value.trim();

    if (!name) return;

    const button = event.submitter;
    button.disabled = true;
    button.textContent = "Adding...";

    try {
        const { error } = await supabaseClient
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

categoryList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-category]");

    if (!button) return;

    const id = button.dataset.deleteCategory;

    if (!confirm(
        "Delete this category? Products in it will become uncategorised."
    )) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("categories")
            .delete()
            .eq("id", id);

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
    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

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

                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    loading="lazy"
                >

                <div class="admin-product-info">

                    <h3>${escapeHTML(product.name)}</h3>

                    <p>${escapeHTML(
                        getCategoryName(product.category_id)
                    )}</p>

                    <p>${images.length} photo(s)</p>

                    <div class="card-actions">

                        <button
                            type="button"
                            data-edit-product="${escapeHTML(product.id)}"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="delete-button"
                            data-delete-product="${escapeHTML(product.id)}"
                        >
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

productModal.addEventListener("click", (event) => {
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

    if (selectedFiles.length > 10) {
        alert("Please select a maximum of 10 photos at a time.");

        selectedFiles = [];
        productImagesInput.value = "";
    }

    const invalidFile = selectedFiles.find(file =>
        !file.type.startsWith("image/") ||
        file.size > 10 * 1024 * 1024
    );

    if (invalidFile) {
        alert("Only image files up to 10 MB each are allowed.");

        selectedFiles = [];
        productImagesInput.value = "";
    }

    renderImagePreview();
});

/* ==========================================
   UPLOAD PRODUCT IMAGES
========================================== */

async function uploadProductImages(productId) {
    const uploadedURLs = [];

    for (const file of selectedFiles) {
        const extension = file.name.split(".").pop()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        const filePath =
            `${currentUser.id}/${productId}/${crypto.randomUUID()}.${extension}`;

        const { error } = await supabaseClient.storage
            .from(BUCKET)
            .upload(filePath, file, {
                contentType: file.type,
                upsert: false
            });

        if (error) {
            throw error;
        }

        const { data } = supabaseClient.storage
            .from(BUCKET)
            .getPublicUrl(filePath);

        uploadedURLs.push(data.publicUrl);
    }

    return uploadedURLs;
}

/* ==========================================
   SAVE PRODUCT
========================================== */

productForm.addEventListener("submit", async (event) => {
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

        const images = [
            ...existingImages,
            ...uploadedURLs
        ];

        const productData = {
            id,
            name,
            description,
            category_id: categoryId,
            images
        };

        let result;

        if (productId) {
            result = await supabaseClient
                .from("products")
                .update(productData)
                .eq("id", productId);
        } else {
            result = await supabaseClient
                .from("products")
                .insert(productData);
        }

        if (result.error) {
            throw result.error;
        }

        showMessage(
            productMessage,
            "Product saved successfully!",
            "success"
        );

        await loadDashboard();

        setTimeout(closeProductModal, 700);

    } catch (error) {
        // Clean up newly uploaded files if saving the product fails.
        if (uploadedURLs.length) {
            const paths = uploadedURLs
                .map(getStoragePath)
                .filter(Boolean);

            if (paths.length) {
                await supabaseClient.storage
                    .from(BUCKET)
                    .remove(paths);
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

productList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-product]");
    const deleteButton = event.target.closest("[data-delete-product]");

    if (editButton) {
        const product = products.find(
            item => item.id === editButton.dataset.editProduct
        );

        if (product) {
            openProductModal(product);
        }

        return;
    }

    if (deleteButton) {
        const id = deleteButton.dataset.deleteProduct;

        const product = products.find(item => item.id === id);

        if (!product) return;

        if (!confirm(
            `Delete "${product.name}" permanently?`
        )) {
            return;
        }

        try {
            const { error } = await supabaseClient
                .from("products")
                .delete()
                .eq("id", id);

            if (error) throw error;

            // Remove the associated photos from Storage.
            const paths = getImages(product)
                .map(getStoragePath)
                .filter(Boolean);

            if (paths.length) {
                const { error: storageError } =
                    await supabaseClient.storage
                        .from(BUCKET)
                        .remove(paths);

                if (storageError) {
                    console.error(
                        "Product deleted, but image cleanup failed:",
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
   STORAGE URL HELPER
========================================== */

function getStoragePath(url) {
    if (typeof url !== "string") return null;

    try {
        const parsed = new URL(url);

        const marker = "/storage/v1/object/public/" + BUCKET + "/";

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
   START APPLICATION
========================================== */

initializeAdmin();


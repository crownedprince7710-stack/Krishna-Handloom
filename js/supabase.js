
/* ==========================================
   THE KRISHNA HANDLOOM
   SUPABASE CONFIGURATION
========================================== */


/* 1. SUPABASE PROJECT CREDENTIALS */

// Replace these with your actual Supabase details.

const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";

const SUPABASE_ANON_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";


/* 2. INITIALIZE SUPABASE */

let supabaseClient = null;

try {

    if (
        SUPABASE_URL.startsWith("https://") &&
        !SUPABASE_URL.includes("YOUR_SUPABASE")
    ) {

        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

        console.log("Krishna Handloom: Supabase connected.");

    } else {

        console.warn(
            "Supabase credentials are not configured yet."
        );

    }

} catch (error) {

    console.error(
        "Supabase initialization failed:",
        error
    );

}


/* 3. GLOBAL CLIENT */

window.supabaseClient = supabaseClient;


/* 4. DATABASE TABLE NAMES */

window.KRISHNA_CONFIG = {

    tables: {

        products: "products",

        categories: "categories"

    },

    storage: {

        productImages: "product-images"

    }

};


/* 5. CONNECTION CHECK */

window.checkSupabaseConnection = async function () {

    if (!window.supabaseClient) {

        console.error("Supabase client is not initialized.");

        return false;

    }

    try {

        const { error } = await window.supabaseClient
            .from("categories")
            .select("id")
            .limit(1);

        if (error) {
            throw error;
        }

        console.log("Supabase connection successful.");

        return true;

    } catch (error) {

        console.error(
            "Supabase connection error:",
            error.message
        );

        return false;

    }

};


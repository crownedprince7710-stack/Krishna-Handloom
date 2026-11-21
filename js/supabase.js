
/* ==========================================
   THE KRISHNA HANDLOOM
   SUPABASE CONFIGURATION
========================================== */

// 1. SUPABASE PROJECT CREDENTIALS

const SUPABASE_URL = "https://oewjxdoirfesqulfywng.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_me0xn2-Esvvprk_kCk8REw_kjjlkRLD";


// 2. INITIALIZE SUPABASE

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

        console.warn("Supabase credentials are not configured.");

    }

} catch (error) {

    console.error("Supabase initialization failed:", error);

}


// 3. GLOBAL CLIENT

window.supabaseClient = supabaseClient;


// 4. DATABASE CONFIGURATION

window.KRISHNA_CONFIG = {

    tables: {
        products: "products",
        categories: "categories"
    },

    storage: {
        productImages: "product-images"
    }

};


// 5. CONNECTION CHECK

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

        if (error) throw error;

        console.log("Supabase connection successful.");

        return true;

    } catch (error) {

        console.error("Supabase connection error:", error.message);

        return false;

    }

};

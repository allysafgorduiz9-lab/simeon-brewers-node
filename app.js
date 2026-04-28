require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

const app = express();

// --- CONFIGURATION ---
// These are your default credentials. 
// Note: You previously had issues with hardcoded secrets, so consider using .env for these.
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123'; 
let storeOpen = true; 

// 1. DATABASE CONNECTION
// This uses the environment variables from your previous deployment on Render/Aiven.
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } 
});

db.connect(err => {
    if (err) { 
        console.error('DB Connection Error:', err); 
        return; 
    }
    console.log('Simeon Brewers Database Connected Successfully!');
});

// 2. MIDDLEWARE & VIEW ENGINE
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'simeon_brewers_secret', 
    resave: false, 
    saveUninitialized: true 
}));

// Middleware to protect admin routes
const isAuthenticated = (req, res, next) => {
    if (req.session.loggedIn) return next();
    res.redirect('/login');
};

// 3. IMAGE UPLOAD CONFIGURATION
const storage = multer.diskStorage({
    destination: './public/images/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- ROUTES ---

// 4. CUSTOMER SIDE (This opens first at localhost:3000)
app.get('/', (req, res) => {
    // Fetches all products to display on your Simeon Cafe menu.
    db.query("SELECT * FROM products ORDER BY category ASC", (err, products) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error loading menu.");
        }
        res.render('index', { products: products || [], storeOpen: storeOpen });
    });
});

// API for the "Live Status" badge in your footer/header
app.get('/api/status', (req, res) => {
    res.json({ storeOpen: storeOpen });
});

// 5. AUTHENTICATION (Staff Login Portal)
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Basic auth check for Simeon Brewers staff.
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/admin/menu');
    } else {
        res.render('login', { error: 'Invalid Credentials' });
    }
});

app.get('/logout', (req, res) => { 
    req.session.destroy(); 
    res.redirect('/login'); 
});

// 6. ADMIN - STORE STATUS TOGGLE
app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    res.json({ storeOpen: storeOpen });
});

// 7. ADMIN - MENU MANAGEMENT
app.get('/admin/menu', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products ORDER BY category ASC", (err, products) => {
        res.render('admin_dashboard', { products: products || [], storeOpen: storeOpen });
    });
});

app.get('/admin/add-product', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
        res.render('add_product', { categories: categories || [], storeOpen: storeOpen });
    });
});

app.post('/admin/save-product', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1 } = req.body;
    const image = req.file ? req.file.filename : 'default.jpg';
    db.query("INSERT INTO products (name, category, price_1, image) VALUES (?, ?, ?, ?)", 
    [name, category, price_1, image], () => {
        res.redirect('/admin/menu');
    });
});

app.get('/admin/edit-product/:id', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
        db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
            res.render('edit_product', { 
                product: product[0], 
                categories: categories || [], 
                storeOpen: storeOpen 
            });
        });
    });
});

app.post('/admin/update-product/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1 } = req.body;
    let sql, params;
    
    if (req.file) {
        sql = "UPDATE products SET name = ?, category = ?, price_1 = ?, image = ? WHERE id = ?";
        params = [name, category, price_1, req.file.filename, req.params.id];
    } else {
        sql = "UPDATE products SET name = ?, category = ?, price_1 = ? WHERE id = ?";
        params = [name, category, price_1, req.params.id];
    }

    db.query(sql, params, () => {
        res.redirect('/admin/menu');
    });
});

app.get('/admin/delete/:id', isAuthenticated, (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], () => {
        res.redirect('/admin/menu');
    });
});

// 8. CATEGORY MANAGEMENT
app.get('/admin/categories', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
        res.render('manage_categories', { categories: categories || [], storeOpen: storeOpen });
    });
});

app.post('/admin/add-category', isAuthenticated, (req, res) => {
    db.query("INSERT INTO categories (name) VALUES (?)", [req.body.name], () => {
        res.redirect('/admin/categories');
    });
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Simeon Brewers running at http://localhost:${PORT}`);
});
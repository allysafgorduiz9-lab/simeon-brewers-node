require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

const app = express();

// Global variable for Store Status
let storeOpen = true; 

// 1. DATABASE CONNECTION (Aiven MySQL)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } 
});

db.connect(err => {
    if (err) { console.error('DB Connection Error:', err); return; }
    console.log('Simeon Brewers Database Connected Successfully!');
});

// 2. MIDDLEWARE & VIEW ENGINE
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'simeon_brewers_secret', 
    resave: false, 
    saveUninitialized: true 
}));

// 3. IMAGE UPLOAD CONFIGURATION (Multer)
const storage = multer.diskStorage({
    destination: './public/images/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 4. ROUTES

// --- STORE STATUS ---
app.post('/admin/toggle-status', (req, res) => {
    storeOpen = !storeOpen;
    res.redirect('/admin/menu'); 
});

// --- MENU MANAGEMENT (DASHBOARD) ---
app.get('/admin/menu', (req, res) => {
    db.query("SELECT * FROM products ORDER BY category ASC", (err, products) => {
        res.render('admin_dashboard', { 
            products: products || [], 
            storeOpen: storeOpen 
        });
    });
});

// Show Add Product Form
app.get('/admin/add-product', (req, res) => {
    res.render('add_product', { storeOpen: storeOpen });
});

// Save New Product
app.post('/admin/save-product', upload.single('image'), (req, res) => {
    const { name, category, price_1 } = req.body;
    const image = req.file ? req.file.filename : 'default.jpg';
    const sql = "INSERT INTO products (name, category, price_1, image) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [name, category, price_1, image], (err) => {
        if (err) { console.error(err); return res.send("Error saving product."); }
        res.redirect('/admin/menu');
    });
});

// Delete Product
app.get('/admin/delete/:id', (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], () => {
        res.redirect('/admin/menu');
    });
});

// --- ACTIVE ORDERS ---
app.get('/admin/orders', (req, res) => {
    const sql = "SELECT * FROM orders WHERE status != 'Completed' ORDER BY created_at DESC";
    db.query(sql, (err, orders) => {
        if (err) { console.error(err); return res.status(500).send("Error loading orders."); }
        res.render('active_orders', { 
            orders: orders || [], 
            storeOpen: storeOpen 
        });
    });
});

// Update Order Status
app.post('/admin/update-order-status/:id', (req, res) => {
    const { status } = req.body;
    db.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id], () => {
        res.redirect('/admin/orders');
    });
});

// --- REDIRECTS & AUTH ---
app.get('/admin', (req, res) => res.redirect('/admin/menu'));
app.get('/', (req, res) => res.send("Simeon Brewers Customer Site Coming Soon"));

// 5. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/admin`);
});

// --- CATEGORY MANAGEMENT ---
app.get('/admin/categories', (req, res) => {
    db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
        if (err) { console.error(err); return res.status(500).send("Error loading categories."); }
        res.render('manage_categories', { 
            categories: categories || [], 
            storeOpen: storeOpen 
        });
    });
});

app.post('/admin/add-category', (req, res) => {
    const { name } = req.body;
    db.query("INSERT INTO categories (name) VALUES (?)", [name], (err) => {
        if (err) console.error(err);
        res.redirect('/admin/categories');
    });
});

app.get('/admin/delete-category/:id', (req, res) => {
    db.query("DELETE FROM categories WHERE id = ?", [req.params.id], () => {
        res.redirect('/admin/categories');
    });
});
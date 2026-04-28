require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

const app = express();

// Global variable for Store Status
let storeOpen = true; 

// 1. DATABASE CONNECTION
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
    console.log('Simeon Brewers Database Connected!');
});

// 2. MIDDLEWARE & VIEW ENGINE
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'simeon_secret', resave: false, saveUninitialized: true }));

// 3. IMAGE UPLOAD CONFIGURATION (Multer)
const storage = multer.diskStorage({
    destination: './public/images/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 4. ROUTES

// Toggle Store Status
app.post('/admin/toggle-status', (req, res) => {
    storeOpen = !storeOpen;
    res.redirect('/admin/menu'); 
});

// Admin Dashboard (Manage Menu)
app.get('/admin/menu', (req, res) => {
    db.query("SELECT * FROM products ORDER BY category ASC", (err, products) => {
        res.render('admin_dashboard', { 
            products: products || [], 
            storeOpen: storeOpen 
        });
    });
});

// Route to SHOW the Add Product Form (Fixes the GET error)
app.get('/admin/add-product', (req, res) => {
    res.render('add_product', { storeOpen: storeOpen });
});

// Route to SAVE the new product to Database
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

// General Redirects
app.get('/admin', (req, res) => res.redirect('/admin/menu'));
app.get('/', (req, res) => res.send("Simeon Brewers Customer Site Coming Soon"));

// 5. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Simeon Brewers running at http://localhost:${PORT}/admin`));
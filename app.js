require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

const app = express();

// Global Store Status (Defined outside routes so it stays in memory)
let storeOpen = true; 

// 1. AIVEN CONNECTION
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } 
});

db.connect(err => {
    if (err) { console.error('DATABASE ERROR:', err); return; }
    console.log('Connected to Aiven MySQL Successfully!');
});

// 2. MIDDLEWARE
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'simeon_secret', resave: false, saveUninitialized: true }));

// 3. IMAGE UPLOAD CONFIG
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
    res.redirect('back');
});

// Manage Menu (Your Main Dashboard)
app.get('/admin/menu', (req, res) => {
    db.query("SELECT * FROM products ORDER BY category", (err, products) => {
        // PASSING BOTH PRODUCTS AND STOREOPEN
        res.render('admin_dashboard', { 
            products: products || [], 
            storeOpen: storeOpen 
        });
    });
});

// Delete Product
app.get('/admin/delete/:id', (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], () => res.redirect('/admin/menu'));
});

// Placeholder routes for other sidebar links to prevent 404s
app.get('/admin/orders', (req, res) => res.send("Active Orders Page Coming Soon"));
app.get('/admin/reports', (req, res) => res.send("Daily Reports Page Coming Soon"));

// Redirect /admin to /admin/menu
app.get('/admin', (req, res) => res.redirect('/admin/menu'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Simeon Brewers Live: http://localhost:${PORT}/admin`));
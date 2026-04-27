require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');

const app = express();

// Global Store Status
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
    if (err) { console.error('DB Connection Failed:', err); return; }
    console.log('Simeon Brewers DB Connected!');
});

// 2. MIDDLEWARE
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'simeon_secret', resave: false, saveUninitialized: true }));

// 3. ROUTES

// Toggle Store Status
app.post('/admin/toggle-status', (req, res) => {
    storeOpen = !storeOpen;
    res.redirect('back');
});

// Main Dashboard (Manage Menu)
app.get('/admin/menu', (req, res) => {
    const query = "SELECT * FROM products ORDER BY category";
    db.query(query, (err, products) => {
        res.render('admin_dashboard', { 
            products: products || [], 
            storeOpen: storeOpen 
        });
    });
});

// Delete Logic
app.get('/admin/delete/:id', (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], () => {
        res.redirect('/admin/menu');
    });
});

// Redirects
app.get('/admin', (req, res) => res.redirect('/admin/menu'));
app.get('/', (req, res) => res.send("Customer Site Coming Soon"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}/admin`));
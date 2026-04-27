require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');

const app = express();

// Global variable to track if Simeon Brewers is Open or Closed
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
    if (err) {
        console.error('DATABASE CONNECTION ERROR:', err);
        return;
    }
    console.log('Simeon Brewers Database: Connected Successfully!');
});

// 2. MIDDLEWARE & SETTINGS
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'simeon_brewers_secret_key', 
    resave: false, 
    saveUninitialized: true 
}));

// 3. ROUTES (FUNCTIONALITIES)

/**
 * STORE STATUS TOGGLE
 * Explicitly redirects to /admin/menu to avoid "Cannot GET /back" error
 */
app.post('/admin/toggle-status', (req, res) => {
    storeOpen = !storeOpen;
    console.log(`Store status changed to: ${storeOpen ? 'OPEN' : 'CLOSED'}`);
    res.redirect('/admin/menu'); 
});

/**
 * MANAGE MENU (ADMIN DASHBOARD)
 * Fetches all coffee and food items from the database
 */
app.get('/admin/menu', (req, res) => {
    const sql = "SELECT * FROM products ORDER BY category ASC, name ASC";
    db.query(sql, (err, products) => {
        if (err) {
            console.error("Fetch Error:", err);
            return res.status(500).send("Error loading menu items.");
        }
        res.render('admin_dashboard', { 
            products: products || [], 
            storeOpen: storeOpen 
        });
    });
});

/**
 * DELETE MENU ITEM
 */
app.get('/admin/delete/:id', (req, res) => {
    const productId = req.params.id;
    db.query("DELETE FROM products WHERE id = ?", [productId], (err) => {
        if (err) console.error("Delete Error:", err);
        res.redirect('/admin/menu');
    });
});

/**
 * PLACEHOLDER ROUTES
 * These prevent 404 errors when clicking sidebar links before the pages are built
 */
app.get('/admin/orders', (req, res) => {
    res.send("<h1>Active Orders</h1><p>This module is under development for Simeon Brewers.</p><a href='/admin/menu'>Back to Dashboard</a>");
});

app.get('/admin/reports', (req, res) => {
    res.send("<h1>Daily Reports</h1><p>Sales tracking will appear here.</p><a href='/admin/menu'>Back to Dashboard</a>");
});

/**
 * AUTHENTICATION & REDIRECTS
 */
app.get('/admin', (req, res) => res.redirect('/admin/menu'));

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin');
    });
});

// 4. SERVER INITIALIZATION
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('-----------------------------------------');
    console.log(`SIMEON BREWERS SYSTEM IS LIVE`);
    console.log(`URL: http://localhost:${PORT}/admin`);
    console.log('-----------------------------------------');
});
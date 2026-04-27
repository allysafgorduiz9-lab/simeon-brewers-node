require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

const app = express();

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
    if (err) {
        console.error('DATABASE ERROR:', err);
        return;
    }
    console.log('Connected to Aiven MySQL Successfully!');
});

// 2. MIDDLEWARE
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'simeon_secret', 
    resave: false, 
    saveUninitialized: true 
}));

// Global Store Status
let storeOpen = true; 

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

// Manage Menu (This is your current Dashboard)
app.get('/admin/menu', (req, res) => {
    db.query("SELECT * FROM products ORDER BY category", (err, products) => {
        res.render('admin_dashboard', { 
            products: products || [], 
            storeOpen 
        });
    });
});

// Active Orders Route
app.get('/admin/orders', (req, res) => {
    db.query("SELECT * FROM orders WHERE status != 'Completed' ORDER BY created_at DESC", (err, orders) => {
        res.render('active_orders', { orders: orders || [], storeOpen });
    });
});

// Update Order Status (Pending -> Preparing -> Completed)
app.post('/admin/update-order/:id', (req, res) => {
    const { status } = req.body;
    db.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id], () => {
        res.redirect('/admin/orders');
    });
});

// Daily Reports
app.get('/admin/reports', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const query = "SELECT SUM(total_price) as dailyTotal FROM orders WHERE DATE(created_at) = ? AND status = 'Completed'";
    db.query(query, [today], (err, result) => {
        res.render('daily_reports', { total: result[0].dailyTotal || 0, storeOpen });
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Redirect root admin to menu
app.get('/admin', (req, res) => res.redirect('/admin/menu'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`System Live: http://localhost:${PORT}/admin`));
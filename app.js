require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123'; 
let storeOpen = true; 

console.log('=== CONFIG ===');
console.log('DB Host:', process.env.DB_HOST);
console.log('DB Name:', process.env.DB_NAME);
console.log('DB Port:', process.env.DB_PORT);

// DATABASE
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } 
});

db.connect((err) => {
    if (err) {
        console.log('❌ DB CONNECTION FAILED:', err.message);
    } else {
        console.log('✅ DB Connected successfully!');
    }
});

// MIDDLEWARE
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'simeon_secret_2024', resave: false, saveUninitialized: true }));

const isAuthenticated = (req, res, next) => {
    if (req.session.loggedIn) return next();
    res.redirect('/login');
};

const upload = multer({ dest: './public/images/' });

// ================= ROUTES =================

// HOME
app.get('/', (req, res) => {
    console.log('>>> Loading HOME');
    db.query("SELECT * FROM products WHERE active = 1 ORDER BY name ASC", (err, products) => {
        if (err) console.log('Home err:', err);
        console.log('Home products:', products ? products.length : 0);
        res.render('index', { products: products || [], storeOpen: storeOpen });
    });
});

// LOGIN
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    if (req.body.username === ADMIN_USERNAME && req.body.password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/admin/menu');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ADMIN - MENU
// ADMIN - MENU
// ADMIN - MENU - Shows ALL products (active + inactive)
app.get('/admin/menu', isAuthenticated, (req, res) => {
    console.log('>>> Loading /admin/menu');
    
    // REMOVE "WHERE active = 1" - shows ALL products now
    db.query("SELECT * FROM products ORDER BY id ASC", (err, products) => {
        console.log('   Products Found:', products ? products.length : 0);
        
        res.render('admin/menu', { 
            products: products || [], 
            categories: [], 
            storeOpen: storeOpen 
        });
    });
});

// SAVE PRODUCT
app.post('/admin/save-product', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1, price_2, price_3, description } = req.body;
    console.log('>>> Saving product:', name);
    
    db.query(
        "INSERT INTO products (name, category, price_1, price_2, price_3, description, image, active) VALUES (?, ?, ?, ?, ?, ?, 'default.jpg', 1)",
        [name, category, price_1, price_2, price_3, description],
        (err, result) => {
            if (err) console.log('Save error:', err);
            else console.log('✅ Saved! ID:', result.insertId);
        }
    );
    
    res.redirect('/admin/menu');
});

// TOGGLE PRODUCT
app.post('/admin/toggle-product', isAuthenticated, (req, res) => {
    db.query("UPDATE products SET active = ? WHERE id = ?", [req.body.active, req.body.productId]);
    res.redirect('/admin/menu');
});

// DELETE PRODUCT
app.get('/admin/delete-product/:id', isAuthenticated, (req, res) => {
    db.query("UPDATE products SET active = 0 WHERE id = ?", [req.params.id]);
    res.redirect('/admin/menu');
});

// CATEGORIES
app.get('/admin/categories', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
        res.render('admin/categories', { categories: categories || [], storeOpen: storeOpen });
    });
});

app.post('/admin/add-category', isAuthenticated, (req, res) => {
    db.query("INSERT INTO categories (name, description) VALUES (?, ?)", [req.body.name, req.body.description]);
    res.redirect('/admin/categories');
});

app.post('/admin/delete-category', isAuthenticated, (req, res) => {
    db.query("DELETE FROM categories WHERE id = ?", [req.body.categoryId]);
    res.redirect('/admin/categories');
});

// ORDERS
app.get('/admin/orders', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM orders ORDER BY id DESC LIMIT 50", (err, orders) => {
        res.render('admin/orders', { orders: orders || [], storeOpen: storeOpen });
    });
});

app.post('/admin/orders/update-status', isAuthenticated, (req, res) => {
    db.query("UPDATE orders SET status = ? WHERE id = ?", [req.body.status, req.body.orderId]);
    res.redirect('/admin/orders');
});

// REPORTS
app.get('/admin/reports', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM orders ORDER BY id DESC", (err, orders) => {
        const total = orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
        res.render('admin/reports', { orders: orders || [], totalOrders: orders.length, totalRevenue: total.toFixed(2), storeOpen: storeOpen });
    });
});

// TOGGLE STORE STATUS
app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    console.log('Store is now:', storeOpen ? 'OPEN' : 'CLOSED');
    res.redirect('back');
});

// API
app.get('/api/status', (req, res) => res.json({ storeOpen: storeOpen }));

app.post('/api/orders', express.json(), (req, res) => {
    const { cart, customer, payment } = req.body;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNumber = 'ORD-' + Date.now().toString().slice(-6);
    
    db.query(
        "INSERT INTO orders (order_number, customer_name, contact_number, total_price, status, items_json) VALUES (?, ?, ?, ?, 'pending', ?)",
        [orderNumber, customer.name, customer.phone, total, JSON.stringify(cart)],
        (err) => {
            if (err) console.log('Order save error:', err);
        }
    );
    
    res.json({ orderNumber, total });
});

// 404
app.use((req, res) => res.status(404).send('Page not found'));

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 Server running: http://localhost:' + PORT);
    console.log('🔐 Login: http://localhost:' + PORT + '/login');
    console.log('👤 Username: admin');
    console.log('👤 Password: password123');
    console.log('');
});
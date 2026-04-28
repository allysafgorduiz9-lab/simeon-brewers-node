require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

const app = express();

// --- CONFIGURATION ---
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123'; 
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

// SECURITY MIDDLEWARE
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

// 4. CUSTOMER ROUTES
app.get('/', (req, res) => {
    db.query("SELECT * FROM products ORDER BY category ASC", (err, products) => {
        if (err) return res.status(500).send("Error loading menu.");
        res.render('index', { products: products || [], storeOpen: storeOpen });
    });
});

app.post('/place-order', (req, res) => {
    const { customer_name, items, total } = req.body;
    const sql = "INSERT INTO orders (customer_name, items, total_amount, status) VALUES (?, ?, ?, 'Pending')";
    db.query(sql, [customer_name, items, total], (err) => {
        if (err) return res.status(500).send("Order failed.");
        res.send(`<h2>Thank you, ${customer_name}!</h2><a href="/">Back to Menu</a>`);
    });
});

// 5. AUTH ROUTES
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/admin/menu');
    } else {
        res.render('login', { error: 'Invalid Credentials' });
    }
});
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// 6. ADMIN ROUTES
app.get('/admin', isAuthenticated, (req, res) => res.redirect('/admin/menu'));

app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    res.redirect('back');
});

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
    db.query("INSERT INTO products (name, category, price_1, image) VALUES (?, ?, ?, ?)", [name, category, price_1, image], () => {
        res.redirect('/admin/menu');
    });
});

// --- EDIT & UPDATE PRODUCT ROUTES ---
app.get('/admin/edit-product/:id', isAuthenticated, (req, res) => {
    const productId = req.params.id;
    db.query("SELECT * FROM products WHERE id = ?", [productId], (err, product) => {
        if (err || product.length === 0) return res.redirect('/admin/menu');
        db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
            res.render('edit_product', { product: product[0], categories: categories || [], storeOpen: storeOpen });
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
    db.query(sql, params, () => res.redirect('/admin/menu'));
});

app.get('/admin/delete/:id', isAuthenticated, (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], () => res.redirect('/admin/menu'));
});

// OTHER ADMIN PAGES
app.get('/admin/orders', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM orders WHERE status != 'Completed' ORDER BY created_at DESC", (err, orders) => {
        res.render('active_orders', { orders: orders || [], storeOpen: storeOpen });
    });
});

app.post('/admin/update-order-status/:id', isAuthenticated, (req, res) => {
    db.query("UPDATE orders SET status = ? WHERE id = ?", [req.body.status, req.params.id], () => res.redirect('/admin/orders'));
});

app.get('/admin/categories', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
        res.render('manage_categories', { categories: categories || [], storeOpen: storeOpen });
    });
});

app.post('/admin/add-category', isAuthenticated, (req, res) => {
    db.query("INSERT INTO categories (name) VALUES (?)", [req.body.name], () => res.redirect('/admin/categories'));
});

app.get('/admin/delete-category/:id', isAuthenticated, (req, res) => {
    db.query("DELETE FROM categories WHERE id = ?", [req.params.id], () => res.redirect('/admin/categories'));
});

app.get('/admin/reports', isAuthenticated, (req, res) => {
    db.query("SELECT COUNT(*) as totalOrders, SUM(total_amount) as totalRevenue FROM orders WHERE status = 'Completed'", (err, results) => {
        const stats = results[0];
        stats.totalRevenue = stats.totalRevenue || 0; 
        res.render('daily_reports', { stats, storeOpen });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}/admin`));
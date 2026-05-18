require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const session = require('express-session');

const app = express();

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123'; 
let storeOpen = true;
let storeStatus = "OPEN";

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'defaultdb',
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) console.log('DB Error:', err.message);
    else console.log('DB Connected!');
});

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'simeon2024', resave: false, saveUninitialized: true }));

const isAuthenticated = (req, res, next) => {
    if (req.session.loggedIn) return next();
    res.redirect('/login');
};

const upload = multer({ dest: './public/images/' });

// HOME
// HOME - with pagination
app.get('/', (req, res) => {
    var page = parseInt(req.query.page) || 1;
    db.query("SELECT * FROM products WHERE active = 1 ORDER BY id ASC", (err, products) => {
        res.render('index', { products: products || [], storeOpen: storeOpen, storeStatus: storeStatus, page: page });
    });
});

// LOGIN
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
    if (req.body.username === ADMIN_USERNAME && req.body.password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/admin/menu');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// ADMIN MENU
app.get('/admin/menu', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products ORDER BY id ASC", (err, products) => {
        res.render('admin/menu', { products: products || [], storeOpen: storeOpen, storeStatus: storeStatus });
    });
});

// SAVE PRODUCT
app.post('/admin/save-product', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1 } = req.body;
    if (!name || !price_1) return res.redirect('/admin/menu');
    const image = req.file ? req.file.filename : 'default.jpg';
    db.query("INSERT INTO products (name, category, price_1, image, active) VALUES (?, ?, ?, ?, 1)",
        [name, category || 'General', price_1, image]);
    res.redirect('/admin/menu');
});

// TOGGLE PRODUCT
app.post('/admin/toggle-product', isAuthenticated, (req, res) => {
    const { productId, active } = req.body;
    db.query("UPDATE products SET active = ? WHERE id = ?", [active, productId]);
    res.json({ success: true });
});

// EDIT PRODUCT
app.get('/admin/edit-product/:id', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, products) => {
        if (products && products.length > 0) {
            res.render('admin/edit_product', { product: products[0], storeOpen: storeOpen, storeStatus: storeStatus });
        } else {
            res.redirect('/admin/menu');
        }
    });
});

// UPDATE PRODUCT
app.post('/admin/update-product/:id', isAuthenticated, (req, res) => {
    const { name, category, price_1, active } = req.body;
    db.query("UPDATE products SET name = ?, category = ?, price_1 = ?, active = ? WHERE id = ?",
        [name, category, price_1, active ? 1 : 0, req.params.id]);
    res.redirect('/admin/menu');
});

// DELETE PRODUCT
app.get('/admin/delete-product/:id', isAuthenticated, (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.redirect('/admin/menu');
});

// CATEGORIES (ADD THIS!)
app.get('/admin/categories', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM categories ORDER BY id ASC", (err, categories) => {
        res.render('admin/categories', { categories: categories || [], storeOpen: storeOpen, storeStatus: storeStatus });
    });
});

app.post('/admin/add-category', isAuthenticated, (req, res) => {
    const { name, description } = req.body;
    if (name) {
        db.query("INSERT INTO categories (name, description) VALUES (?, ?)", [name, description || '']);
    }
    res.redirect('/admin/categories');
});

app.post('/admin/delete-category', isAuthenticated, (req, res) => {
    const { categoryId } = req.body;
    db.query("DELETE FROM categories WHERE id = ?", [categoryId]);
    res.redirect('/admin/categories');
});

// TOGGLE STORE
app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    storeStatus = storeOpen ? "OPEN" : "CLOSED";
    res.json({ success: true });
});

// ORDERS
app.get('/admin/orders', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM orders ORDER BY id DESC", (err, orders) => {
        res.render('admin/orders', { orders: orders || [], storeOpen: storeOpen, storeStatus: storeStatus });
    });
});

app.post('/admin/orders/update-status', isAuthenticated, (req, res) => {
    const { orderId, status } = req.body;
    db.query("UPDATE orders SET status = ? WHERE id = ?", [status, orderId]);
    res.redirect('/admin/orders');
});

// REPORTS
app.get('/admin/reports', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM orders", (err, orders) => {
        const total = orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
        res.render('admin/reports', { orders: orders || [], totalOrders: orders.length, totalRevenue: total.toFixed(2), storeOpen: storeOpen, storeStatus: storeStatus });
    });
});

// API
app.get('/api/status', (req, res) => res.json({ storeOpen: storeOpen }));

app.post('/api/orders', express.json(), (req, res) => {
    const { cart, customer } = req.body;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNumber = 'ORD-' + Date.now().toString().slice(-6);
    db.query("INSERT INTO orders (order_number, customer_name, contact_number, total_price, status, items_json) VALUES (?, ?, ?, ?, 'pending', ?)",
        [orderNumber, customer.name, customer.phone, total, JSON.stringify(cart)]);
    res.json({ orderNumber, total });
});

app.use((req, res) => res.status(404).send('Not Found'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});
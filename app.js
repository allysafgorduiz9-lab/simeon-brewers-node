require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const session = require('express-session');

const app = express();

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123'; 
let storeOpen = true; 

console.log('=== SIMEON BREWERS ===');
console.log('DB:', process.env.DB_NAME);

// DATABASE - Added connection timeout and retry
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 10000
});

db.connect((err) => {
    if (err) {
        console.log('❌ DB Error:', err.message);
    } else {
        console.log('✅ DB Connected!');
    }
});

// Error handler for database
db.on('error', (err) => {
    console.log('DB Error:', err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Reconnecting...');
        db.connect();
    }
});

// MIDDLEWARE
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'simeon2024', resave: false, saveUninitialized: true, cookie: { maxAge: 3600000 } }));

const isAuthenticated = (req, res, next) => {
    if (req.session.loggedIn) return next();
    res.redirect('/login');
};

const upload = multer({ dest: './public/images/' });

// ================= ROUTES =================

// HOME
app.get('/', (req, res) => {
    db.query("SELECT * FROM products ORDER BY id ASC", (err, products) => {
        res.render('index', { products: products || [], storeOpen: storeOpen });
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
    const sql = "SELECT * FROM products ORDER BY id ASC";
    db.query(sql, (err, products) => {
        if (err) {
            console.log('Error:', err.message);
            products = [];
        }
        res.render('admin/menu', { products: products || [], storeOpen: storeOpen });
    });
});

// SAVE PRODUCT - Fixed!
app.post('/admin/save-product', isAuthenticated, upload.single('image'), (req, res) => {
    try {
        const { name, category, price_1, price_2, price_3, description } = req.body;
        
        if (!name || name.trim() === '') {
            return res.redirect('/admin/menu');
        }
        
        const sql = "INSERT INTO products (name, category, price_1, price_2, price_3, description, image, active) VALUES (?, ?, ?, ?, ?, ?, 'default.jpg', 1)";
        db.query(sql, [name, category || 'General', price_1 || 0, price_2 || 0, price_3 || 0, description || ''], (err) => {
            if (err) console.log('Save error:', err.message);
            else console.log('Saved!');
        });
        
        res.redirect('/admin/menu');
    } catch (e) {
        console.log('Error:', e.message);
        res.redirect('/admin/menu');
    }
});

// EDIT PRODUCT
app.get('/admin/edit-product/:id', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, products) => {
        if (products && products.length > 0) {
            res.render('admin/edit_product', { product: products[0], storeOpen: storeOpen });
        } else {
            res.redirect('/admin/menu');
        }
    });
});

// UPDATE PRODUCT
app.post('/admin/update-product/:id', isAuthenticated, (req, res) => {
    const { name, category, price_1, price_2, price_3, description, active } = req.body;
    const sql = "UPDATE products SET name=?, category=?, price_1=?, price_2=?, price_3=?, description=?, active=? WHERE id=?";
    db.query(sql, [name, category, price_1, price_2, price_3, description, active ? 1 : 0, req.params.id]);
    res.redirect('/admin/menu');
});

// DELETE PRODUCT
app.get('/admin/delete-product/:id', isAuthenticated, (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
        if (err) console.log('Delete error:', err.message);
    });
    res.redirect('/admin/menu');
});

// CATEGORIES
app.get('/admin/categories', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM categories", (err, categories) => {
        res.render('admin/categories', { categories: categories || [], storeOpen: storeOpen });
    });
});

app.post('/admin/add-category', isAuthenticated, (req, res) => {
    db.query("INSERT INTO categories (name, description) VALUES (?, ?)", [req.body.name, req.body.description]);
    res.redirect('/admin/categories');
});

// ORDERS
app.get('/admin/orders', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM orders ORDER BY id DESC", (err, orders) => {
        res.render('admin/orders', { orders: orders || [], storeOpen: storeOpen });
    });
});

app.post('/admin/orders/update-status', isAuthenticated, (req, res) => {
    db.query("UPDATE orders SET status = ? WHERE id = ?", [req.body.status, req.body.orderId]);
    res.redirect('/admin/orders');
});

// REPORTS
app.get('/admin/reports', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM orders", (err, orders) => {
        const total = orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
        res.render('admin/reports', { orders: orders || [], totalOrders: orders.length, totalRevenue: total.toFixed(2), storeOpen: storeOpen });
    });
});

// TOGGLE STORE STATUS
app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    res.redirect('back');
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

// 404
app.use((req, res) => res.status(404).send('Not Found'));

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 http://localhost:' + PORT);
    console.log('🔐 Login: admin / password123');
});
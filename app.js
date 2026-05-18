require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const session = require('express-session');

const app = express();

// ========== CONFIGURATION ==========
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123';
const PORT = process.env.PORT || 3000;
let storeOpen = true;
let storeStatus = "OPEN";

// ========== DATABASE ==========
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

// ========== MIDDLEWARE ==========
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'simeon2024', 
    resave: false, 
    saveUninitialized: true 
}));

// Auth middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.loggedIn) return next();
    res.redirect('/login');
};

// File upload
const upload = multer({ dest: './public/images/' });

// ========== PUBLIC ROUTES ==========

// Home - with pagination
app.get('/', (req, res) => {
    var page = parseInt(req.query.page) || 1;
    db.query("SELECT * FROM products WHERE active = 1 ORDER BY id ASC", (err, products) => {
        res.render('index', { 
            products: products || [], 
            storeOpen: storeOpen, 
            storeStatus: storeStatus, 
            page: page 
        });
    });
});

// About page
app.get('/about', (req, res) => {
    res.render('about');
});

// Checkout
app.get('/checkout', (req, res) => {
    res.render('checkout');
});

// Login page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Login handler
app.post('/login', (req, res) => {
    if (req.body.username === ADMIN_USERNAME && req.body.password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/admin/menu');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ========== ADMIN ROUTES (Protected) ==========

// Admin Menu
app.get('/admin/menu', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products ORDER BY id ASC", (err, products) => {
        res.render('admin/menu', { 
            products: products || [], 
            storeOpen: storeOpen, 
            storeStatus: storeStatus 
        });
    });
});

// Save Product
app.post('/admin/save-product', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1 } = req.body;
    if (!name || !price_1) return res.redirect('/admin/menu');
    const image = req.file ? req.file.filename : 'default.jpg';
    db.query("INSERT INTO products (name, category, price_1, image, active) VALUES (?, ?, ?, ?, 1)",
        [name, category || 'General', price_1, image]);
    res.redirect('/admin/menu');
});

// Toggle Product
app.post('/admin/toggle-product', isAuthenticated, (req, res) => {
    const { productId, active } = req.body;
    db.query("UPDATE products SET active = ? WHERE id = ?", [active, productId]);
    res.json({ success: true });
});

// Edit Product
app.get('/admin/edit-product/:id', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, products) => {
        if (products && products.length > 0) {
            res.render('admin/edit_product', { 
                product: products[0], 
                storeOpen: storeOpen, 
                storeStatus: storeStatus 
            });
        } else {
            res.redirect('/admin/menu');
        }
    });
});

// Update Product
app.post('/admin/update-product/:id', isAuthenticated, (req, res) => {
    const { name, category, price_1, active } = req.body;
    db.query("UPDATE products SET name = ?, category = ?, price_1 = ?, active = ? WHERE id = ?",
        [name, category, price_1, active ? 1 : 0, req.params.id]);
    res.redirect('/admin/menu');
});

// Delete Product
app.get('/admin/delete-product/:id', isAuthenticated, (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.redirect('/admin/menu');
});

// Categories
app.get('/admin/categories', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM categories ORDER BY id ASC", (err, categories) => {
        res.render('admin/categories', { 
            categories: categories || [], 
            storeOpen: storeOpen, 
            storeStatus: storeStatus 
        });
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

// Toggle Store Status
app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    storeStatus = storeOpen ? "OPEN" : "CLOSED";
    res.json({ success: true, storeOpen, storeStatus });
});

// Orders
app.get('/admin/orders', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM orders ORDER BY id DESC", (err, orders) => {
        res.render('admin/orders', { 
            orders: orders || [], 
            storeOpen: storeOpen, 
            storeStatus: storeStatus 
        });
    });
});

app.post('/admin/orders/update-status', isAuthenticated, (req, res) => {
    const { orderId, status } = req.body;
    db.query("UPDATE orders SET status = ? WHERE id = ?", [status, orderId]);
    res.redirect('/admin/orders');
});

// Reports
app.get('/admin/reports', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM orders", (err, orders) => {
        const total = orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
        res.render('admin/reports', { 
            orders: orders || [], 
            totalOrders: orders.length, 
            totalRevenue: total.toFixed(2), 
            storeOpen: storeOpen, 
            storeStatus: storeStatus 
        });
    });
});

// ========== API ROUTES ==========

app.get('/api/status', (req, res) => {
    res.json({ storeOpen: storeOpen });
});

app.post('/api/orders', express.json(), (req, res) => {
    const { cart, customer } = req.body;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNumber = 'ORD-' + Date.now().toString().slice(-6);
    
    db.query(
        "INSERT INTO orders (order_number, customer_name, contact_number, total_price, status, items_json) VALUES (?, ?, ?, ?, 'pending', ?)",
        [orderNumber, customer.name, customer.phone, total, JSON.stringify(cart)]
    );
    
    res.json({ orderNumber, total });
});

// ========== 404 CATCH-ALL (Must be last) ==========

app.use((req, res) => {
    res.status(404).send('Page Not Found');
});

// ========================
// API: Place Order
// ========================
app.post('/api/orders', (req, res) => {
    const { 
        orderNumber, customerName, customerPhone, orderType, 
        items, subtotal, totalAmount, paymentMethod, refNumber, specialInstructions 
    } = req.body;

    const sql = `
        INSERT INTO active_orders 
        (order_number, customer_name, customer_phone, order_type, items, subtotal, total_amount, payment_method, ref_number, special_instructions, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    `;

    const values = [
        orderNumber, customerName, customerPhone, orderType,
        JSON.stringify(items), subtotal, totalAmount, paymentMethod, refNumber, specialInstructions
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Database Error:', err);
            return res.status(500).json({ success: false, message: 'Failed to place order' });
        }
        res.json({ success: true, message: 'Order placed successfully', orderId: result.insertId });
    });
});

// ========================
// Admin: View Orders
// ========================
app.get('/admin/orders', (req, res) => {
    const sql = 'SELECT * FROM active_orders ORDER BY created_at DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error loading orders');
        }

        const orders = results.map(order => {
            try {
                order.items = JSON.parse(order.items);
            } catch (e) {
                order.items = [];
            }
            return order;
        });

        res.render('admin/orders', { orders });
    });
});

// ========================
// API: Update Order Status
// ========================
app.post('/api/orders/update-status', (req, res) => {
    const { orderId, status } = req.body;
    db.query('UPDATE active_orders SET status = ? WHERE id = ?', [status, orderId], (err, result) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

// ========== SERVER START ==========

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
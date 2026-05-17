require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- CONFIGURATION ---
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123'; 
let storeOpen = true; 

// 1. DATABASE CONNECTION
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'simeon_brewers',
    port: process.env.DB_PORT || 3306,
    ssl: { rejectUnauthorized: false } 
});

db.connect(err => {
    if (err) { 
        console.error('❌ DB Connection Error:', err); 
        console.log('🚀 Server still starting (using fallback storage)...');
    } else {
        console.log('✅ Simeon Brewers Database Connected!');
    }
});

// 2. MIDDLEWARE
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'simeon_brewers_secret_2024', 
    resave: false, 
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Auth middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.loggedIn) return next();
    res.redirect('/login');
};

// 3. IMAGE UPLOAD
const storage = multer.diskStorage({
    destination: './public/images/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Ensure images directory exists
if (!fs.existsSync('./public/images')) {
    fs.mkdirSync('./public/images', { recursive: true });
}

// --- CUSTOMER ROUTES ---

app.get('/', (req, res) => {
    if (!db.connected) {
        return res.render('index', { products: [], storeOpen: storeOpen });
    }
    
    db.query("SELECT * FROM products WHERE active = 1 ORDER BY category ASC, name ASC", (err, products) => {
        if (err) {
            console.error('Home page products error:', err);
            return res.render('index', { products: [], storeOpen: storeOpen });
        }
        res.render('index', { products: products || [], storeOpen: storeOpen });
    });
});

app.get('/checkout', (req, res) => {
    res.render('checkout', { storeOpen: storeOpen });
});

// 🎯 FIXED: Multiple order endpoints that work with your checkout page
app.post('/api/orders', express.json(), (req, res) => {
    try {
        const orderData = req.body;
        console.log('📦 New order received:', orderData.customer?.name || 'Unknown');
        
        // Calculate total with delivery fee
        let subtotal = 0;
        orderData.cart.forEach(item => {
            subtotal += item.price * item.quantity;
        });
        const deliveryFee = orderData.customer?.type === 'Delivery' ? 50 : 0;
        const total = subtotal + deliveryFee;
        
        // Generate order number
        const orderNumber = 'ORD-' + Date.now().toString().slice(-6);
        
        const order = {
            orderNumber,
            items: orderData.cart,
            subtotal,
            deliveryFee,
            total,
            status: 'pending',
            customer: orderData.customer,
            payment: orderData.payment,
            createdAt: new Date().toISOString()
        };
        
        // Save to database (if connected)
        if (db.connected) {
            const sql = `INSERT INTO orders (
                order_number, customer_name, contact_number, order_type, notes, 
                payment_method, reference_number, subtotal, delivery_fee, total_price, 
                status, items_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            db.query(sql, [
                orderNumber,
                order.customer.name,
                order.customer.phone,
                order.customer.type,
                order.customer.notes,
                order.payment.method,
                order.payment.refNumber || '',
                subtotal,
                deliveryFee,
                total,
                'pending',
                JSON.stringify(orderData.cart),
                new Date()
            ], (err) => {
                if (err) {
                    console.error('❌ DB Order Save Error:', err);
                    // Still return success - fallback to file
                } else {
                    console.log('✅ Order saved to DB:', orderNumber);
                }
            });
        }
        
        // Fallback: Save to JSON file
        let orders = [];
        if (fs.existsSync('./orders.json')) {
            orders = JSON.parse(fs.readFileSync('./orders.json'));
        }
        orders.unshift(order);
        fs.writeFileSync('./orders.json', JSON.stringify(orders.slice(0, 500), null, 2));
        
        console.log('✅ Order processed:', orderNumber, 'Total: ₱' + total.toFixed(2));
        res.json(order);
        
    } catch (error) {
        console.error('❌ Order processing error:', error);
        res.status(500).json({ error: 'Order failed: ' + error.message });
    }
});

// Status API
app.get('/api/status', (req, res) => {
    res.json({ storeOpen: storeOpen });
});

// --- ADMIN ROUTES ---

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        req.session.user = { username };
        res.redirect('/admin/orders');
    } else {
        res.render('login', { error: 'Invalid Credentials' });
    }
});

app.get('/logout', (req, res) => { 
    req.session.destroy(err => {
        if (err) console.error('Session destroy error:', err);
        res.redirect('/login'); 
    });
});

// Store status toggle
app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    console.log('🏪 Store status:', storeOpen ? 'OPEN' : 'CLOSED');
    res.json({ storeOpen });
});

// Admin Dashboard
app.get('/admin/orders', isAuthenticated, (req, res) => {
    if (!db.connected) {
        return res.render('active_orders', { orders: [], storeOpen });
    }
    
    db.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100", (err, orders) => {
        if (err) {
            console.error('Orders fetch error:', err);
            return res.render('active_orders', { orders: [], storeOpen });
        }
        res.render('active_orders', { orders: orders || [], storeOpen });
    });
});

app.get('/admin/menu', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products WHERE active = 1 ORDER BY category ASC, id DESC", (err, products) => {
        if (err) {
            console.error('Menu fetch error:', err);
            return res.render('admin_dashboard', { products: [], storeOpen });
        }
        res.render('admin_dashboard', { products: products || [], storeOpen });
    });
});

// Product CRUD
app.get('/admin/add-product', isAuthenticated, (req, res) => {
    db.query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC", (err, results) => {
        const categories = results ? results.map(row => row.category).filter(Boolean) : [];
        res.render('add_product', { categories, storeOpen });
    });
});

app.post('/admin/save-product', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1, price_2, price_3, description } = req.body;
    const image = req.file ? req.file.filename : 'default.jpg';
    
    const sql = "INSERT INTO products (name, category, price_1, price_2, price_3, description, image, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)";
    db.query(sql, [name, category || 'General', parseFloat(price_1) || 0, parseFloat(price_2) || 0, parseFloat(price_3) || 0, description || '', image], (err) => {
        if (err) console.error('Product save error:', err);
        res.redirect('/admin/menu');
    });
});

app.get('/admin/edit-product/:id', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
        if (err || !product[0]) return res.redirect('/admin/menu');
        
        db.query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category ASC", (err, results) => {
            const categories = results ? results.map(row => row.category).filter(Boolean) : [];
            res.render('edit_product', { product: product[0], categories, storeOpen });
        });
    });
});

app.post('/admin/update-product/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1, price_2, price_3, description, active } = req.body;
    const id = req.params.id;
    
    if (req.file) {
        db.query("UPDATE products SET name=?, category=?, price_1=?, price_2=?, price_3=?, description=?, image=?, active=? WHERE id=?", 
            [name, category, parseFloat(price_1), parseFloat(price_2), parseFloat(price_3), description, req.file.filename, active === 'on' ? 1 : 0, id]);
    } else {
        db.query("UPDATE products SET name=?, category=?, price_1=?, price_2=?, price_3=?, description=?, active=? WHERE id=?", 
            [name, category, parseFloat(price_1), parseFloat(price_2), parseFloat(price_3), description, active === 'on' ? 1 : 0, id]);
    }
    res.redirect('/admin/menu');
});

app.get('/admin/delete/:id', isAuthenticated, (req, res) => {
    db.query("UPDATE products SET active = 0 WHERE id = ?", [req.params.id], (err) => {
        if (err) console.error('Soft delete error:', err);
        res.redirect('/admin/menu');
    });
});

// Categories
app.get('/admin/categories', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
        res.render('manage_categories', { categories: categories || [], storeOpen });
    });
});

app.post('/admin/add-category', isAuthenticated, (req, res) => {
    db.query("INSERT IGNORE INTO categories (name) VALUES (?)", [req.body.name], () => {
        res.redirect('/admin/categories');
    });
});

// Reports
app.get('/admin/reports', isAuthenticated, (req, res) => {
    res.render('reports', { storeOpen });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).render('404', { storeOpen });
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Simeon Brewers Server running on http://localhost:${PORT}`);
    console.log(`🔐 Admin Login: http://localhost:${PORT}/login`);
    console.log(`👤 Username: ${ADMIN_USERNAME} | Password: ${ADMIN_PASSWORD}`);
    console.log(`🏪 Store Status: ${storeOpen ? 'OPEN' : 'CLOSED'}`);
});
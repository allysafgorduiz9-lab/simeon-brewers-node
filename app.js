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
    database: process.env.DB_NAME || 'defaultdb',
    port: process.env.DB_PORT || 23249,
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

// Orders API
app.post('/api/orders', express.json(), (req, res) => {
    try {
        const orderData = req.body;
        console.log('📦 New order received:', orderData.customer?.name || 'Unknown');
        
        let subtotal = 0;
        orderData.cart.forEach(item => {
            subtotal += item.price * item.quantity;
        });
        const deliveryFee = orderData.customer?.type === 'Delivery' ? 50 : 0;
        const total = subtotal + deliveryFee;
        
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
        
        // Save to database
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
                if (err) console.error('❌ DB Order Save Error:', err);
                else console.log('✅ Order saved to DB:', orderNumber);
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
    res.redirect('/admin/reports');
});

// ==================== ADMIN DASHBOARD ====================

// Active Orders
app.get('/admin/orders', isAuthenticated, (req, res) => {
    const orders = [];
    const query = "SELECT * FROM orders ORDER BY created_at DESC LIMIT 50";
    
    if (db.connected) {
        db.query(query, (err, rows) => {
            if (err) {
                console.error('Orders fetch error:', err);
            } else {
                rows.forEach(row => {
                    let items = [];
                    try {
                        items = JSON.parse(row.items_json || '[]');
                    } catch(e) {}
                    
                    const date = new Date(row.created_at);
                    orders.push({
                        ...row,
                        items: items,
                        time: date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
                        date: date.toLocaleDateString('en-PH')
                    });
                });
            }
            res.render('admin/orders', { orders, storeOpen, title: 'Active Orders' });
        });
    } else {
        res.render('admin/orders', { orders, storeOpen, title: 'Active Orders' });
    }
});

// Update Order Status
app.post('/admin/orders/update-status', isAuthenticated, (req, res) => {
    const { orderId, status } = req.body;
    if (db.connected) {
        db.query("UPDATE orders SET status = ? WHERE id = ?", [status, orderId], (err) => {
            if (err) console.error('Update status error:', err);
        });
    }
    res.redirect('/admin/orders');
});

// Manage Menu (products)
app.get('/admin/menu', isAuthenticated, (req, res) => {
    const menuItems = [];
    const categories = [];
    
    if (db.connected) {
        db.query("SELECT * FROM categories ORDER BY name ASC", (err, cats) => {
            if (!err && cats) cats.forEach(c => categories.push(c));
            
            db.query("SELECT * FROM products ORDER BY name ASC", (err, rows) => {
                if (err) {
                    console.error('Menu fetch error:', err);
                } else {
                    rows.forEach(row => menuItems.push(row));
                }
                res.render('admin/menu', { menuItems, categories, storeOpen, title: 'Manage Menu' });
            });
        });
    } else {
        res.render('admin/menu', { menuItems, categories, storeOpen, title: 'Manage Menu' });
    }
});

// Add Menu Item
app.post('/admin/menu/add', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price, description } = req.body;
    const image = req.file ? req.file.filename : 'default.jpg';
    
    if (db.connected) {
        db.query(
            "INSERT INTO products (name, category, price, description, image, active) VALUES (?, ?, ?, ?, ?, 1)",
            [name, category || 'General', parseFloat(price) || 0, description || '', image],
            (err) => {
                if (err) console.error('Product save error:', err);
            }
        );
    }
    res.redirect('/admin/menu');
});

// Delete Menu Item
app.post('/admin/menu/delete', isAuthenticated, (req, res) => {
    const { itemId } = req.body;
    if (db.connected) {
        db.query("UPDATE products SET active = 0 WHERE id = ?", [itemId], (err) => {
            if (err) console.error('Delete error:', err);
        });
    }
    res.redirect('/admin/menu');
});

// Manage Categories
app.get('/admin/categories', isAuthenticated, (req, res) => {
    const categories = [];
    
    if (db.connected) {
        db.query("SELECT * FROM categories ORDER BY name ASC", (err, rows) => {
            if (!err && rows) rows.forEach(c => categories.push(c));
            res.render('admin/categories', { categories, storeOpen, title: 'Manage Categories' });
        });
    } else {
        res.render('admin/categories', { categories, storeOpen, title: 'Manage Categories' });
    }
});

// Add Category
app.post('/admin/categories/add', isAuthenticated, (req, res) => {
    const { name, description } = req.body;
    if (db.connected) {
        db.query("INSERT INTO categories (name, description) VALUES (?, ?)", [name, description], (err) => {
            if (err) console.error('Category add error:', err);
        });
    }
    res.redirect('/admin/categories');
});

// Delete Category
app.post('/admin/categories/delete', isAuthenticated, (req, res) => {
    const { categoryId } = req.body;
    if (db.connected) {
        db.query("DELETE FROM categories WHERE id = ?", [categoryId], (err) => {
            if (err) console.error('Category delete error:', err);
        });
    }
    res.redirect('/admin/categories');
});

// Daily Reports
app.get('/admin/reports', isAuthenticated, (req, res) => {
    const orders = [];
    const today = new Date().toISOString().split('T')[0];
    
    if (db.connected) {
        db.query("SELECT * FROM orders WHERE DATE(created_at) = ? ORDER BY created_at DESC", [today], (err, rows) => {
            if (err) {
                console.error('Reports fetch error:', err);
            } else {
                rows.forEach(row => {
                    let items = [];
                    let itemsSummary = '';
                    try {
                        items = JSON.parse(row.items_json || '[]');
                        itemsSummary = items.map(i => i.name + ' x' + i.quantity).join(', ');
                    } catch(e) {
                        itemsSummary = 'N/A';
                    }
                    
                    const date = new Date(row.created_at);
                    orders.push({
                        order_number: row.order_number,
                        customer_name: row.customer_name,
                        contact_number: row.contact_number,
                        items_summary: itemsSummary,
                        total_price: parseFloat(row.total_price || 0).toFixed(2),
                        status: row.status,
                        time: date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
                    });
                });
            }
            
            const totalOrders = orders.length;
            const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0).toFixed(2);
            
            res.render('admin/reports', { 
                orders, 
                totalOrders, 
                totalRevenue, 
                storeOpen,
                title: 'Daily Reports'
            });
        });
    } else {
        res.render('admin/reports', { 
            orders: [], 
            totalOrders: 0, 
            totalRevenue: '0.00', 
            storeOpen,
            title: 'Daily Reports'
        });
    }
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
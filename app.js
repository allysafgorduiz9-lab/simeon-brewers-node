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

if (!fs.existsSync('./public/images')) {
    fs.mkdirSync('./public/images', { recursive: true });
}

// --- CUSTOMER ROUTES ---

app.get('/', (req, res) => {
    if (!db.connected) {
        return res.render('index', { products: [], storeOpen: storeOpen });
    }
    
    db.query("SELECT * FROM products WHERE active = 1 ORDER BY category ASC, name ASC", (err, products) => {
        if (err) return res.render('index', { products: [], storeOpen: storeOpen });
        res.render('index', { products: products || [], storeOpen: storeOpen });
    });
});

app.get('/checkout', (req, res) => {
    res.render('checkout', { storeOpen: storeOpen });
});

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
        
        if (db.connected) {
            const sql = `INSERT INTO orders (
                order_number, customer_name, contact_number, order_type, notes, 
                payment_method, reference_number, subtotal, delivery_fee, total_price, 
                status, items_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
            
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
                JSON.stringify(orderData.cart)
            ], (err) => {
                if (err) console.error('❌ DB Order Save Error:', err);
                else console.log('✅ Order saved to DB:', orderNumber);
            });
        }
        
        // Fallback
        let orders = [];
        if (fs.existsSync('./orders.json')) {
            orders = JSON.parse(fs.readFileSync('./orders.json'));
        }
        orders.unshift(order);
        fs.writeFileSync('./orders.json', JSON.stringify(orders.slice(0, 500), null, 2));
        
        console.log('✅ Order processed:', orderNumber, 'Total: ₱' + total.toFixed(2));
        res.json(order);
        
    } catch (error) {
        console.error('❌ Order error:', error);
        res.status(500).json({ error: 'Order failed' });
    }
});

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
        res.redirect('/admin/orders');
    } else {
        res.render('login', { error: 'Invalid Credentials' });
    }
});

app.get('/logout', (req, res) => { 
    req.session.destroy();
    res.redirect('/login');
});

app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    console.log('🏪 Store status:', storeOpen ? 'OPEN' : 'CLOSED');
    res.redirect('/admin/reports');
});

// Active Orders
app.get('/admin/orders', isAuthenticated, (req, res) => {
    if (!db.connected) return res.render('admin/orders', { orders: [], storeOpen });
    
    db.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50", (err, rows) => {
        const orders = [];
        if (!err && rows) {
            rows.forEach(row => {
                let items = [];
                try { items = JSON.parse(row.items_json || '[]'); } catch(e) {}
                const date = new Date(row.created_at);
                orders.push({
                    ...row,
                    items: items,
                    time: date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
                });
            });
        }
        res.render('admin/orders', { orders, storeOpen });
    });
});

app.post('/admin/orders/update-status', isAuthenticated, (req, res) => {
    const { orderId, status } = req.body;
    if (db.connected) {
        db.query("UPDATE orders SET status = ? WHERE id = ?", [status, orderId]);
    }
    res.redirect('/admin/orders');
});

// Manage Menu
app.get('/admin/menu', isAuthenticated, (req, res) => {
    if (!db.connected) return res.render('admin/menu', { products: [], categories: [], storeOpen });
    
    db.query("SELECT * FROM products ORDER BY name ASC", (err, products) => {
        db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
            res.render('admin/menu', { 
                products: products || [], 
                categories: categories || [], 
                storeOpen 
            });
        });
    });
});

app.get('/admin/add-product', isAuthenticated, (req, res) => {
    if (!db.connected) return res.redirect('/admin/menu');
    
    db.query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category ASC", (err, results) => {
        const categories = results ? results.map(r => r.category).filter(Boolean) : [];
        res.render('admin/add_product', { categories, storeOpen });
    });
});

app.post('/admin/save-product', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1, price_2, price_3, description } = req.body;
    const image = req.file ? req.file.filename : 'default.jpg';
    
    if (db.connected) {
        db.query(
            "INSERT INTO products (name, category, price_1, price_2, price_3, description, image, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
            [name, category || 'General', parseFloat(price_1)||0, parseFloat(price_2)||0, parseFloat(price_3)||0, description||'', image]
        );
    }
    res.redirect('/admin/menu');
});

app.get('/admin/edit-product/:id', isAuthenticated, (req, res) => {
    if (!db.connected) return res.redirect('/admin/menu');
    
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
        if (err || !product[0]) return res.redirect('/admin/menu');
        res.render('admin/edit_product', { product: product[0], categories: [], storeOpen });
    });
});

app.post('/admin/update-product/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1, price_2, price_3, description, active } = req.body;
    const id = req.params.id;
    
    if (db.connected) {
        if (req.file) {
            db.query("UPDATE products SET name=?, category=?, price_1=?, price_2=?, price_3=?, description=?, image=?, active=? WHERE id=?", 
                [name, category, parseFloat(price_1)||0, parseFloat(price_2)||0, parseFloat(price_3)||0, description||'', req.file.filename, active==='on'?1:0, id]);
        } else {
            db.query("UPDATE products SET name=?, category=?, price_1=?, price_2=?, price_3=?, description=?, active=? WHERE id=?", 
                [name, category, parseFloat(price_1)||0, parseFloat(price_2)||0, parseFloat(price_3)||0, description||'', active==='on'?1:0, id]);
        }
    }
    res.redirect('/admin/menu');
});

app.get('/admin/delete-product/:id', isAuthenticated, (req, res) => {
    if (db.connected) {
        db.query("UPDATE products SET active = 0 WHERE id = ?", [req.params.id]);
    }
    res.redirect('/admin/menu');
});

// Categories
app.get('/admin/categories', isAuthenticated, (req, res) => {
    if (!db.connected) return res.render('admin/categories', { categories: [], storeOpen });
    
    db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
        res.render('admin/categories', { categories: categories || [], storeOpen });
    });
});

app.post('/admin/add-category', isAuthenticated, (req, res) => {
    const { name, description } = req.body;
    if (db.connected) {
        db.query("INSERT INTO categories (name, description) VALUES (?, ?)", [name, description]);
    }
    res.redirect('/admin/categories');
});

app.post('/admin/delete-category', isAuthenticated, (req, res) => {
    const { categoryId } = req.body;
    if (db.connected) {
        db.query("DELETE FROM categories WHERE id = ?", [categoryId]);
    }
    res.redirect('/admin/categories');
});

// Reports
app.get('/admin/reports', isAuthenticated, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    if (!db.connected) return res.render('admin/reports', { orders:[], totalOrders:0, totalRevenue:'0.00', storeOpen });
    
    db.query("SELECT * FROM orders WHERE DATE(created_at) = ? ORDER BY created_at DESC", [today], (err, rows) => {
        const orders = [];
        if (!err && rows) {
            rows.forEach(row => {
                let items = [], itemsSummary = '';
                try {
                    items = JSON.parse(row.items_json || '[]');
                    itemsSummary = items.map(i => i.name + ' x' + i.quantity).join(', ');
                } catch(e) { itemsSummary = 'N/A'; }
                
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
        
        res.render('admin/reports', { orders, totalOrders, totalRevenue, storeOpen });
    });
});

// 404
app.use((req, res) => {
    res.status(404).render('404', { storeOpen });
});

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔐 Login: http://localhost:${PORT}/login`);
    console.log(`👤 ${ADMIN_USERNAME} | ${ADMIN_PASSWORD}`);
});

// Toggle Product Availability
// Toggle Product Availability
app.post('/admin/toggle-product', isAuthenticated, (req, res) => {
    const { productId, active } = req.body;
    if (db.connected) {
        db.query("UPDATE products SET active = ? WHERE id = ?", [active, productId], (err) => {
            if (err) console.error('Toggle error:', err);
        });
    }
    res.redirect('/admin/menu');
});
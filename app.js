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
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'simeon_brewers_secret', 
    resave: false, 
    saveUninitialized: true 
}));

// Protects admin pages from unauthorized access
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

// --- CUSTOMER SIDE ROUTES ---

// 4. CUSTOMER SIDE (HOME PAGE)
app.get('/', (req, res) => {
    // Added safety: If DB returns nothing, we send an empty array [] to avoid EJS crash
    db.query("SELECT * FROM products ORDER BY category ASC", (err, products) => {
        if (err) {
            console.error(err);
            return res.render('index', { products: [], storeOpen: storeOpen });
        }
        res.render('index', { products: products || [], storeOpen: storeOpen });
    });
});

// 5. ADD TO CART / PLACE ORDER API
app.post('/api/place-order', (req, res) => {
    const { customer_name, items, total_price } = req.body;

    // Check if data is arriving correctly
    if (!customer_name || !items) {
        return res.status(400).json({ success: false, message: "Missing order details" });
    }

    const sql = "INSERT INTO orders (customer_name, items, total_price, status) VALUES (?, ?, ?, 'Pending')";
    db.query(sql, [customer_name, items, total_price], (err, result) => {
        if (err) {
            console.error("MySQL Order Error:", err);
            return res.status(500).json({ success: false });
        }
        console.log(`New order from ${customer_name}!`);
        res.status(200).json({ success: true });
    });
});

// Live Status API for Footer/Header Badges
app.get('/api/status', (req, res) => {
    res.json({ storeOpen: storeOpen });
});

// --- ADMIN SIDE ROUTES ---

// 6. AUTHENTICATION (STAFF PORTAL)
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

app.get('/logout', (req, res) => { 
    req.session.destroy(); 
    res.redirect('/login'); 
});

// 7. ADMIN - STORE STATUS TOGGLE (AJAX)
app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    res.json({ storeOpen: storeOpen });
});

// 8. ADMIN - ACTIVE ORDERS
app.get('/admin/orders', isAuthenticated, (req, res) => {
    const sql = "SELECT * FROM orders ORDER BY created_at DESC";
    db.query(sql, (err, orders) => {
        res.render('active_orders', { orders: orders || [], storeOpen: storeOpen });
    });
});

// 9. ADMIN - MENU MANAGEMENT
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
    db.query("INSERT INTO products (name, category, price_1, image) VALUES (?, ?, ?, ?)", 
    [name, category, price_1, image], () => {
        res.redirect('/admin/menu');
    });
});

app.get('/admin/edit-product/:id', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
        db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
            res.render('edit_product', { 
                product: product[0], 
                categories: categories || [], 
                storeOpen: storeOpen 
            });
        });
    });
});

app.post('/admin/update-product/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1 } = req.body;
    const imgSql = req.file ? ", image = ?" : "";
    const params = req.file ? [name, category, price_1, req.file.filename, req.params.id] : [name, category, price_1, req.params.id];
    db.query(`UPDATE products SET name = ?, category = ?, price_1 = ? ${imgSql} WHERE id = ?`, params, () => {
        res.redirect('/admin/menu');
    });
});

app.get('/admin/delete/:id', isAuthenticated, (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], () => res.redirect('/admin/menu'));
});

// 10. CATEGORY MANAGEMENT
app.get('/admin/categories', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM categories ORDER BY name ASC", (err, categories) => {
        res.render('manage_categories', { categories: categories || [], storeOpen: storeOpen });
    });
});

app.post('/admin/add-category', isAuthenticated, (req, res) => {
    db.query("INSERT INTO categories (name) VALUES (?)", [req.body.name], () => {
        res.redirect('/admin/categories');
    });
});

app.get('/admin/delete-category/:id', isAuthenticated, (req, res) => {
    const categoryId = req.params.id;
    db.query("SELECT name FROM categories WHERE id = ?", [categoryId], (err, results) => {
        if (err || results.length === 0) return res.redirect('/admin/categories');
        const categoryName = results[0].name;

        db.query("SELECT COUNT(*) as count FROM products WHERE category = ?", [categoryName], (err, result) => {
            if (result[0].count > 0) {
                return res.send("<script>alert('Error: This category has active products!'); window.location='/admin/categories';</script>");
            }
            db.query("DELETE FROM categories WHERE id = ?", [categoryId], () => res.redirect('/admin/categories'));
        });
    });
});

// 11. REPORTS
app.get('/admin/reports', isAuthenticated, (req, res) => {
    res.render('reports', { storeOpen: storeOpen });
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Simeon Brewers running on http://localhost:${PORT}`);
});

// This tells Express what to do when someone clicks "Checkout"
app.get('/checkout', (req, res) => {
    // Make sure 'checkout' matches the name of your file in the /views folder
    // We pass storeOpen so the header styling doesn't break
    res.render('checkout', { 
        storeOpen: true // You can replace this with your actual time-checking logic
    });
});

// Route to handle order submission
app.post('/api/place-order', (req, res) => {
    const { customer_name, contact_number, order_type, notes, payment_method, reference_number, items, total_price } = req.body;

    const sql = `INSERT INTO orders (customer_name, contact_number, order_type, notes, payment_method, reference_number, items, total_price, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`;

    db.query(sql, [customer_name, contact_number, order_type, notes, payment_method, reference_number, items, total_price], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database Error");
        }
        res.status(200).send("Order Placed");
    });
});

app.post('/api/place-order', (req, res) => {
    console.log("Order received:", req.body); // Check if data is arriving

    const { customer_name, contact_number, order_type, notes, payment_method, reference_number, items, total_price } = req.body;

    const sql = `INSERT INTO orders (customer_name, contact_number, order_type, notes, payment_method, reference_number, items, total_price, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`;

    db.query(sql, [customer_name, contact_number, order_type, notes, payment_method, reference_number, items, total_price], (err, result) => {
        if (err) {
            console.error("DATABASE ERROR:", err); // This prints the real error in your terminal
            return res.status(500).json({ error: err.message });
        }
        res.status(200).send("Order Placed");
    });
});
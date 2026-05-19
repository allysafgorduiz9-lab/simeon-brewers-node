require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// File upload setup
const upload = multer({ dest: './public/images/' });

// ========== CONFIGURATION ==========
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123';
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

// ========== PUBLIC ROUTES ==========

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

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/checkout', (req, res) => {
    res.render('checkout');
});

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

// ========== API ROUTES ==========

app.get('/api/status', (req, res) => {
    res.json({ storeOpen: storeOpen });
});

// Get Order Status by Order Number
app.get('/api/orders/status/:orderNumber', (req, res) => {
    const orderNumber = req.params.orderNumber;
    
    db.query('SELECT status FROM active_orders WHERE order_number = ?', [orderNumber], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }
        
        res.json({ success: true, status: results[0].status });
    });
});

// Place Order
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

// ========== ADMIN ROUTES (Protected) ==========

// Toggle Store Status
app.post('/admin/toggle-status', isAuthenticated, (req, res) => {
    storeOpen = !storeOpen;
    storeStatus = storeOpen ? "OPEN" : "CLOSED";
    res.json({ success: true, storeOpen, storeStatus });
});

// Menu Management
app.get('/admin/menu', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM products ORDER BY id ASC", (err, products) => {
        res.render('admin/menu', { 
            products: products || [], 
            storeOpen: storeOpen, 
            storeStatus: storeStatus 
        });
    });
});

// Save New Product
app.post('/admin/save-product', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1 } = req.body;
    if (!name || !price_1) return res.redirect('/admin/menu');
    const image = req.file ? req.file.filename : 'default.jpg';
    db.query("INSERT INTO products (name, category, price_1, image, active) VALUES (?, ?, ?, ?, 1)",
        [name, category || 'General', price_1, image]);
    res.redirect('/admin/menu');
});

// Toggle Product Availability
app.post('/admin/toggle-product', isAuthenticated, (req, res) => {
    const { productId, active } = req.body;
    db.query("UPDATE products SET active = ? WHERE id = ?", [active, productId]);
    res.json({ success: true });
});

// Edit Product Form
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
app.post('/admin/update-product/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const { name, category, price_1, active } = req.body;
    const activeValue = active === '1' ? 1 : 0;
    const image = req.file ? req.file.filename : req.body.existing_image;
    
    const sql = `UPDATE products SET name = ?, category = ?, price_1 = ?, active = ?, image = ? WHERE id = ?`;
    
    db.query(sql, [name, category, price_1, activeValue, image, req.params.id], (err) => {
        if (err) {
            console.error('Update Error:', err);
        }
        res.redirect('/admin/menu');
    });
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

// Orders Management
// Orders Management
// Orders Management
app.get('/admin/orders', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM active_orders ORDER BY id DESC", (err, results) => {
        if (err) {
            console.error('Orders Error:', err);
            return res.render('admin/orders', { 
                orders: [], 
                storeOpen: storeOpen, 
                storeStatus: storeStatus 
            });
        }

        // Process each order - parse the items JSON
        const orders = results.map(order => {
            try {
                // Parse the items column from JSON string to array
                let parsedItems = [];
                if (order.items) {
                    parsedItems = JSON.parse(order.items);
                }
                order.items = parsedItems;
            } catch (e) {
                console.log('Parse error for order:', order.order_number, e.message);
                order.items = [];
            }
            return order;
        });

        res.render('admin/orders', { 
            orders: orders, 
            storeOpen: storeOpen, 
            storeStatus: storeStatus 
        });
    });
});

// Update Order Status
app.post('/admin/orders/update-status', isAuthenticated, (req, res) => {
    const { orderId, status } = req.body;
    
    const validStatuses = ['Pending', 'Preparing', 'Completed'];
    if (!validStatuses.includes(status)) {
        return res.redirect('/admin/orders');
    }
    
    db.query("UPDATE active_orders SET status = ? WHERE id = ?", [status, orderId], (err) => {
        if (err) console.error(err);
        res.redirect('/admin/orders');
    });
});

// Reports
// Reports
// Reports
app.get('/admin/reports', isAuthenticated, (req, res) => {
    db.query("SELECT * FROM active_orders ORDER BY created_at DESC", (err, orders) => {
        if (err) {
            console.error(err);
            return res.render('admin/reports', { 
                orders: [], 
                totalOrders: 0, 
                totalRevenue: '0.00', 
                storeOpen: storeOpen, 
                storeStatus: storeStatus 
            });
        }

        // Parse items JSON for each order
        const processedOrders = orders.map(order => {
            try {
                // Parse items from JSON string to array
                order.items = JSON.parse(order.items);
                
                // Create items summary text
                const itemNames = order.items.map(item => item.name + ' x' + item.quantity);
                order.items_summary = itemNames.join(', ');
                
            } catch (e) {
                order.items = [];
                order.items_summary = 'No items';
            }
            
            return order;
        });

        // Calculate totals (only completed orders)
        const completedOrders = processedOrders.filter(o => o.status === 'Completed');
        const total = completedOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
        
        res.render('admin/reports', { 
            orders: processedOrders, 
            totalOrders: completedOrders.length, 
            totalRevenue: total.toFixed(2), 
            storeOpen: storeOpen, 
            storeStatus: storeStatus 
        });
    });
});

// ========== 404 CATCH-ALL ==========

app.use((req, res) => {
    res.status(404).send('Page Not Found');
});

// ========== SERVER START ==========

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
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
app.post('/admin/save-product', isAuthenticated, upload.single('imageFile'), (req, res) => {

    const { name, category, price_1 } = req.body;

    if (!name || !price_1) {
        return res.redirect('/admin/menu');
    }

    let image = 'default.png';

    if (req.file) {
        image = req.file.filename;
    }

    const sql = `
        INSERT INTO products 
        (name, category, price_1, image, active)
        VALUES (?, ?, ?, ?, 1)
    `;

    db.query(sql, [name, category, price_1, image], (err) => {

        if (err) {
            console.log('Database Error:', err);
            return res.status(500).send('Internal Server Error');
        }

        res.redirect('/admin/menu');

    });

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
    const { name, category, price_1, active, imageUrl, existing_image } = req.body;
    const activeValue = active === '1' ? 1 : 0;
    
    // Use URL if provided, otherwise use uploaded file, otherwise keep existing
    const image = imageUrl || (req.file ? req.file.filename : existing_image);
    
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
    const { name } = req.body;
    if (name) {
        db.query("INSERT INTO categories (name) VALUES (?)", [name]);
    }
    res.redirect('/admin/categories');
});

app.post('/admin/delete-category', isAuthenticated, (req, res) => {
    const { categoryId } = req.body;
    db.query("DELETE FROM categories WHERE id = ?", [categoryId]);
    res.redirect('/admin/categories');
});

// Orders Management
// Orders Management with Pagination (10 per page)
app.get('/admin/orders', isAuthenticated, (req, res) => {
    const itemsPerPage = 10;
    const currentPage = parseInt(req.query.page) || 1;
    
    // Get total count
    db.query("SELECT COUNT(*) as total FROM active_orders", (err, countResult) => {
        if (err) {
            console.error('DB Error:', err);
            return res.render('admin/orders', { 
                orders: [], 
                storeOpen: storeOpen, 
                storeStatus: storeStatus,
                currentPage: 1,
                totalPages: 1,
                activeCount: 0
            });
        }
        
        const totalOrders = countResult[0].total;
        const totalPages = Math.ceil(totalOrders / itemsPerPage);
        const offset = (currentPage - 1) * itemsPerPage;
        
        // Get paginated orders
        db.query("SELECT * FROM active_orders ORDER BY id DESC LIMIT ? OFFSET ?", [itemsPerPage, offset], (err, results) => {
            if (err) {
                console.error('DB Error:', err);
                return res.render('admin/orders', { 
                    orders: [], 
                    storeOpen: storeOpen, 
                    storeStatus: storeStatus,
                    currentPage: 1,
                    totalPages: 1,
                    activeCount: 0
                });
            }

            // Parse items JSON
            const orders = results.map(order => {
                try {
                    if (order.items && typeof order.items === 'string') {
                        order.items = JSON.parse(order.items);
                    }
                } catch (e) {
                    order.items = [];
                }
                return order;
            });
            
            // Get active orders count (not completed)
            const activeCount = orders.filter(o => o.status !== 'Completed').length;

            res.render('admin/orders', { 
                orders: orders, 
                storeOpen: storeOpen, 
                storeStatus: storeStatus,
                currentPage: currentPage,
                totalPages: totalPages,
                activeCount: activeCount
            });
        });
    });
});

// Update Order Status
app.post('/admin/orders/update-status', isAuthenticated, (req, res) => {
    const { orderId, status } = req.body;
    
    db.query("UPDATE active_orders SET status = ? WHERE id = ?", [status, orderId], (err) => {
        if (err) {
            console.error('Update Error:', err);
        }
        res.redirect('/admin/orders');
    });
});

// Reports
// Reports
app.get('/admin/reports', isAuthenticated, function(req, res) {
    var page = parseInt(req.query.page) || 1;
    var limit = 10;
    var offset = (page - 1) * limit;
    
    db.query("SELECT * FROM active_orders ORDER BY id DESC LIMIT ? OFFSET ?", [limit, offset], function(err, orders) {
        if (err) return res.render('admin/reports', {
            orders: [], totalOrders: 0, totalRevenue: '0.00',
            storeStatus: storeStatus, currentPage: 1, totalPages: 1,
            bestSellers: []
        });

        // Process each order
        var parsed = orders.map(function(o) {
            var itemsStr = o.items;
            var itemsArr = [];
            
            if (itemsStr) {
                if (typeof itemsStr === 'string') {
                    try {
                        itemsArr = JSON.parse(itemsStr);
                    } catch(e) {
                        itemsArr = [];
                    }
                } else if (Array.isArray(itemsStr)) {
                    itemsArr = itemsStr;
                }
            }
            
            o.items = itemsArr;
            return o;
        });

        db.query("SELECT * FROM active_orders WHERE status='Completed'", function(err2, all) {
            var completed = all || [];
            var totalRev = 0;
            
            completed.forEach(function(o) {
                totalRev += parseFloat(o.total_amount) || 0;
            });

            // Calculate best sellers
            var productCounts = {};
            completed.forEach(function(o) {
                var items = [];
                try {
                    items = JSON.parse(o.items);
                } catch(e) {
                    items = o.items || [];
                }
                items.forEach(function(item) {
                    var name = item.name || 'Unknown';
                    if (!productCounts[name]) productCounts[name] = 0;
                    productCounts[name] += parseInt(item.quantity) || 1;
                });
            });

            var bestSellers = Object.keys(productCounts)
                .map(function(name) { return { name: name, count: productCounts[name] }; })
                .sort(function(a, b) { return b.count - a.count; })
                .slice(0, 5);

            res.render('admin/reports', {
                orders: parsed,
                totalOrders: completed.length,
                totalRevenue: totalRev.toFixed(2),
                storeStatus: storeStatus,
                currentPage: page,
                totalPages: Math.ceil((all || []).length / limit),
                bestSellers: bestSellers
            });
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
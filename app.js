require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const session = require('express-session');

const app = express();
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123';
let storeOpen = true;

// DATABASE
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
});

db.connect(err => console.log(err ? '❌ DB Error' : '✅ DB Connected'));

// MIDDLEWARE
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'key', resave: false, saveUninitialized: true }));

const isAuth = (req, res, next) => req.session.loggedIn ? next() : res.redirect('/login');
const upload = multer({ dest: './public/images/' });

// HOME
app.get('/', (req, res) => res.render('index', { products: [], storeOpen }));

// LOGIN
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
    if (req.body.username === ADMIN_USERNAME && req.body.password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/admin/menu');
    } else res.render('login', { error: 'Wrong' });
});
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// ADMIN MENU - Shows ALL products
app.get('/admin/menu', isAuth, (req, res) => {
    db.query("SELECT * FROM products ORDER BY id ASC", (err, products) => {
        console.log('Products:', products.length);
        res.render('admin/menu', { products: products || [], storeOpen });
    });
});

// SAVE PRODUCT
app.post('/admin/save-product', isAuth, upload.single('image'), (req, res) => {
    const { name, category, price_1, price_2, price_3, description } = req.body;
    db.query("INSERT INTO products (name, category, price_1, price_2, price_3, description, image, active) VALUES (?, ?, ?, ?, ?, ?, 'default.jpg', 1)",
        [name, category, price_1, price_2, price_3, description]);
    console.log('Saved:', name);
    res.redirect('/admin/menu');
});

// TOGGLE
app.post('/admin/toggle-product', isAuth, (req, res) => {
    db.query("UPDATE products SET active = ? WHERE id = ?", [req.body.active, req.body.productId]);
    res.redirect('/admin/menu');
});

// DELETE
app.get('/admin/delete-product/:id', isAuth, (req, res) => {
    db.query("UPDATE products SET active = 0 WHERE id = ?", [req.params.id]);
    res.redirect('/admin/menu');
});

// EDIT
app.get('/admin/edit-product/:id', isAuth, (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
        res.render('admin/edit_product', { product: product[0], storeOpen });
    });
});

app.post('/admin/update-product/:id', isAuth, (req, res) => {
    const { name, category, price_1, price_2, price_3, description } = req.body;
    db.query("UPDATE products SET name=?, category=?, price_1=?, price_2=?, price_3=?, description=? WHERE id=?",
        [name, category, price_1, price_2, price_3, description, req.params.id]);
    res.redirect('/admin/menu');
});

// OTHERS
app.get('/admin/orders', isAuth, (req, res) => res.render('admin/orders', { orders: [], storeOpen }));
app.get('/admin/categories', isAuth, (req, res) => res.render('admin/categories', { categories: [], storeOpen }));
app.get('/admin/reports', isAuth, (req, res) => res.render('admin/reports', { orders: [], totalOrders: 0, totalRevenue: '0', storeOpen }));
app.post('/admin/toggle-status', isAuth, (req, res) => { storeOpen = !storeOpen; res.redirect('back'); });

const PORT = 3000;
app.listen(PORT, () => console.log('🚀 http://localhost:' + PORT));
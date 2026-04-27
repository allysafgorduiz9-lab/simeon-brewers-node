require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

const app = express();

// 1. AIVEN CONNECTION (Includes SSL for security)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } 
});

db.connect(err => {
    if (err) {
        console.error('DATABASE ERROR: Check your .env credentials or internet.');
        return;
    }
    console.log('Connected to Aiven MySQL Successfully!');
});

// 2. MIDDLEWARE (Links your Design/CSS)
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'simeon_secret', resave: false, saveUninitialized: true }));

// 3. IMAGE UPLOAD CONFIG
const storage = multer.diskStorage({
    destination: './public/images/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 4. FUNCTIONALITIES (Routes)
app.get('/admin', (req, res) => {
    db.query("SELECT * FROM products ORDER BY category", (err, products) => {
        db.query("SELECT * FROM orders ORDER BY created_at DESC", (err, orders) => {
            res.render('admin_dashboard', { products, orders });
        });
    });
});

app.post('/admin/add-product', upload.single('image'), (req, res) => {
    const { name, category, price_1, price_2 } = req.body;
    const image = req.file ? req.file.filename : 'default.jpg';
    const sql = "INSERT INTO products (name, category, price_1, price_2, image) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [name, category, price_1, price_2, image], () => res.redirect('/admin'));
});

app.get('/admin/delete/:id', (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], () => res.redirect('/admin'));
});

app.listen(process.env.PORT, () => console.log(`System Live: http://localhost:${process.env.PORT}/admin`));
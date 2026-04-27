require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } 
});

const createTablesQuery = `
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price_1 DECIMAL(10, 2) NOT NULL,
    image VARCHAR(255) DEFAULT 'default.jpg',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(255),
    items TEXT,
    total_amount DECIMAL(10, 2),
    status ENUM('Pending', 'Preparing', 'Completed') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

db.connect(err => {
    if (err) throw err;
    console.log("Connected! Creating tables...");
    
    // We split the queries to run them one by one
    db.query(createTablesQuery.split(';')[0], (err) => {
        if (err) console.error("Error creating products:", err);
        else console.log("Table 'products' created!");
        
        db.query(createTablesQuery.split(';')[1], (err) => {
            if (err) console.error("Error creating orders:", err);
            else console.log("Table 'orders' created!");
            process.exit();
        });
    });
});
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const dbConfig = require("../config/dbConfig"); // create dbConfig.js for db connection
const db = require("../config/dbConfig");



// Show login page
exports.getLogin = (req, res) => {
  let message = "";

  if (req.query.reset === "success") {
    message = "Password reset successful! Please login.";
  } else if (req.query.register === "success") {
    message = "Registration successful! Please login.";
  }

  res.render("login", { message });
};
exports.postLogin = async (req, res) => {
  try {
    let { username, password } = req.body;
    username = username.trim();
    password = password.trim();

    // 1. Find user in DB
    const [rows] = await dbConfig.query("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      return res.render("login", { message: "Invalid username or password!" });
    }

    const user = rows[0];

    // 2. Compare entered password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("login", { message: "Invalid username or password!" });
    }

    // 3. Save session and redirect
    req.session.user = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
    };

    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Error in postLogin:", err);
    return res.status(500).render("login", { message: "Server error during login." });
  }
};
// Show forgot password page
exports.getForgot = (req, res) => {
  res.render("forgot", { message: "" });
};
// Handle forgot password
exports.postForgot = async (req, res) => {
  const { email, phone_no, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.render("forgot", { message: "Passwords do not match!" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      "SELECT * FROM users WHERE email = ? AND phone_no = ?",
      [email, phone_no]
    );

    if (rows.length === 0) {
      await connection.end();
      return res.render("forgot", { message: "User not found with that email & phone!" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await connection.execute(
      "UPDATE users SET password = ? WHERE email = ? AND phone_no = ?",
      [hashedPassword, email, phone_no]
    );
    await connection.end();

    res.redirect("/?reset=success");
  } catch (err) {
    console.error(err);
    res.render("forgot", { message: "Server error. Try again!" });
  }
};
// Dashboard
exports.getDashboard = (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  res.render("dashboard", { username: req.session.user });
};
// Logout
exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect("/");
};
exports.registerUser = async (req, res) => {
  try {
    const { fullName, email, username, password, phone_no } = req.body;

    // Check if username or email already exists
    const [existing] = await dbConfig.query(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existing.length > 0) {
      return res.render("register", { message: "Username or Email already exists!" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user (created_at handled by MySQL default)
    await dbConfig.query(
      `INSERT INTO users (full_name, username, email, phone_no, password)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName, username, email, phone_no, hashedPassword]
    );

    // Redirect to login page with success message
    return res.redirect("/?register=success");

  } catch (err) {
    console.error("Error in registerUser:", err.message);
    return res.status(500).render("register", { message: "Server error during registration." });
  }
};

exports.getShop = (req, res) => {
  res.render("shop");
};
exports.getShopDashboard = async (req, res) => {
  try {
    // ✅ Fetch all products including 'sold'
    const [products] = await dbConfig.query(
      `SELECT id, name, category, cost_price, sell_price, stock, sold
       FROM products ORDER BY name ASC`
    );

    // ✅ Fetch sales with product info
    const [sales] = await dbConfig.query(`
      SELECT s.product_id, s.quantity, s.total_price, s.sale_date, 
             p.name, p.cost_price, p.sell_price
      FROM sales s
      JOIN products p ON s.product_id = p.id
    `);

    // Initialize profit trackers
    let dailyProfit = 0,
        weeklyProfit = 0,
        monthlyProfit = 0,
        totalProfit = 0,
        totalLoss = 0;

    const today = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    // Sales Data for charts
    const salesData = { labels: [], values: [] };
    const soldCountByProduct = {};

    sales.forEach(s => {
      const profitPerUnit = s.sell_price - s.cost_price;
      const productProfit = profitPerUnit * s.quantity;
      totalProfit += productProfit;

      // Date filters
      const saleDate = new Date(s.sale_date);
      const diffDays = Math.floor((today - saleDate) / oneDay);

      if (diffDays === 0) dailyProfit += productProfit;
      if (diffDays <= 7) weeklyProfit += productProfit;
      if (diffDays <= 30) monthlyProfit += productProfit;

      // Track sales count per product
      soldCountByProduct[s.name] =
        (soldCountByProduct[s.name] || 0) + s.quantity;
    });

    // Loss: unsold low-stock products
    products.forEach(p => {
      if (p.stock < 5) {
        totalLoss += p.cost_price * p.stock;
      }
    });

    // Build chart labels and values
    for (const [name, count] of Object.entries(soldCountByProduct)) {
      salesData.labels.push(name);
      salesData.values.push(count);
    }

    // Useful vs Non-useful
    const usefulCount = products.filter(p => p.category === "useful").length;
    const nonUsefulCount = products.filter(
      p => p.category === "non-useful"
    ).length;

    // Products categorization
    const lowStockProducts = products.filter(p => p.stock < 5);
    const unsoldProducts = products.filter(p => !soldCountByProduct[p.name]);
    const topSellingProducts = Object.entries(soldCountByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // ✅ Pass all data to the view
    res.render("shop", {
      title: "Shop Dashboard",
      products,
      dailyProfit,
      weeklyProfit,
      monthlyProfit,
      totalProfit,
      totalLoss,
      salesData,
      usefulCount,
      nonUsefulCount,
      lowStockProducts,
      unsoldProducts,
      topSellingProducts,
      message: ""
    });
  } catch (err) {
    console.error(err);
    res.render("shop", {
      title: "Shop Dashboard",
      products: [],
      dailyProfit: 0,
      weeklyProfit: 0,
      monthlyProfit: 0,
      totalProfit: 0,
      totalLoss: 0,
      salesData: { labels: [], values: [] },
      usefulCount: 0,
      nonUsefulCount: 0,
      lowStockProducts: [],
      unsoldProducts: [],
      topSellingProducts: [],
      message: "Error loading products"
    });
  }
};
exports.getAllProducts = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM products ORDER BY id DESC');
    res.json({ success: true, products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
exports.addProduct = async (req, res) => {
  try {
    const { name, description, category, cost_price, sell_price, stock } = req.body;
    const image = req.file ? '/images/' + req.file.filename : null;

    await db.execute(
      'INSERT INTO products (name, description, category, cost_price, sell_price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description, category, cost_price, sell_price, stock, image]
    );

    res.json({ success: true, message: 'Product added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { name, description, category, cost_price, sell_price, stock, sold } = req.body;
    const id = req.params.id;
    const image = req.file ? '/uploads/' + req.file.filename : null;

    const query = image
      ? 'UPDATE products SET name=?, description=?, category=?, cost_price=?, sell_price=?, stock=?, sold=?, image=? WHERE id=?'
      : 'UPDATE products SET name=?, description=?, category=?, cost_price=?, sell_price=?, stock=?, sold=? WHERE id=?';

    const params = image
      ? [name, description, category, cost_price, sell_price, stock, sold || 0, image, id]
      : [name, description, category, cost_price, sell_price, stock, sold || 0, id];

    await db.execute(query, params);
    res.json({ success: true, message: 'Product updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
exports.deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    await db.execute('DELETE FROM products WHERE id=?', [id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
exports.getProductById = async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await dbConfig.execute('SELECT * FROM products WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
exports.getAllSales = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM sales ORDER BY date DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error fetching sales' });
    }
};
exports.addSale = async (req, res) => {
    try {
        const { fullname, quantity } = req.body; // now req.body will exist
        await db.execute('INSERT INTO sales (fullname, quantity) VALUES (?, ?)', [fullname, quantity]);
        res.json({ success: true, message: 'Sale added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error adding sale' });
    }
};
exports.getPL = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, summary_date AS date, fullname, product_name, quantity, sell_price, cost_price, profit
      FROM profit_loss_summary
      ORDER BY summary_date ASC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching P&L:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.addSale = async (req, res) => {
  try {
    const { fullname, product_name, quantity, date } = req.body;

    // Get product prices
    const [productRows] = await db.execute(
      'SELECT sell_price, cost_price FROM products WHERE name = ? LIMIT 1',
      [product_name]
    );

    if (productRows.length === 0) {
      return res.status(400).json({ success: false, message: "Product not found" });
    }

    const { sell_price, cost_price } = productRows[0];
    const totalSales = sell_price * quantity;
    const totalExpenses = cost_price * quantity;
    const profit = totalSales - totalExpenses;

    // Insert sale into profit_loss_summary (one row per sale)
    await db.execute(
      `INSERT INTO profit_loss_summary 
       (summary_date, fullname, product_name, quantity, sell_price, cost_price, profit, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [date, fullname, product_name, quantity, sell_price, cost_price, profit]
    );

    res.json({ success: true, message: "Sale recorded successfully" });
  } catch (err) {
    console.error("Error in addSale:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.addExpense = async (req, res) => {
  try {
    const { description, amount, date } = req.body;

    // 1. Insert expense into the expenses table
    await db.execute(
      `INSERT INTO expenses
       (description, amount, date, created_at)
       VALUES (?, ?, ?, NOW())`,
      [description, amount, date]
    );

    res.json({ success: true, message: "Expense recorded successfully" });
  } catch (err) {
    console.error("Error in addExpense:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.getStockStatus = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, name, description, image, category, cost_price, sell_price, stock, sold, created_at, updated_at
      FROM products
      ORDER BY category, name
    `);

    res.json({ success: true, products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

































exports.getHome = (req, res) => {
  res.render("Home");
} ;
exports.getProductManagement = (req, res) => {
  res.render("product_management");
} ;
exports.getSales = (req, res) => {
  res.render("Sales");
} ;
exports.getProfiteLoss = (req, res) => {
  res.render("profite_loss");
} ;
exports.getStockStatus = (req, res) => {
  res.render("Stock_status");
} ;
exports.getAnalysis = (req, res) => {
  res.render("Analysis");
} ;
exports.getNotification = (req, res) => {
  res.render("notification");
} ;
exports.getSettings = (req, res) => {
  res.render("settings");
} ;
exports.getDebits = (req, res) => {
  res.render("Debits");
} ;
exports.getAuditLogs = (req, res) => {
  res.render("Audit_logs");
} ;
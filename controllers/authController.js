const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const dbConfig = require("../config/dbConfig"); // create dbConfig.js for db connection
const db = require("../config/dbConfig");




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
exports.getForgot = (req, res) => {
  res.render("forgot", { message: "" });
};
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
exports.getDashboard = (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  res.render("dashboard", { username: req.session.user });
};
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
exports.getProductById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const [rows] = await dbConfig.execute(
      'SELECT id, name, cost_price, sell_price, stock, description, image FROM products WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, product: rows[0] });
  } catch (err) {
    console.error('Error fetching product by ID:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
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
    const { fullname, quantity } = req.body;

    // Insert into database and get the inserted ID
    const [result] = await db.execute(
      'INSERT INTO sales (fullname, quantity, date) VALUES (?, ?, NOW())',
      [fullname, quantity]
    );

    // Construct the new sale object
    const newSale = {
      id: result.insertId,      // Database-generated primary key
      fullname,
      quantity,
      date: new Date()          // Current timestamp
    };

    return res.json({
      success: true,
      message: 'Sale added successfully',
      sale: newSale
    });
  } catch (err) {
    console.error('Error in addSale:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error adding sale'
    });
  }
};

exports.getPL = async (req, res) => {
  try {
    // Fetch all sales
    const [salesRows] = await db.execute(`
      SELECT id, summary_date, fullname, product_name, quantity_product, sell_price, cost_price, total_sales, total_expenses, profit
      FROM profit_loss_summary
      ORDER BY summary_date ASC
    `);

    // Fetch all expenses
    const [expenseRows] = await db.execute(`
      SELECT id, description, amount, date
      FROM expenses
      ORDER BY date ASC
    `);

    res.json({ success: true, data: { sales: salesRows, expenses: expenseRows } });
  } catch (err) {
    console.error("Error fetching P&L:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// exports.addSale = async (req, res) => {
//   try {
//     let { fullname, product_name, quantity_product, date } = req.body;

//     // Trim strings safely
//     fullname = fullname?.trim();
//     product_name = product_name?.trim();

//     // Ensure numeric quantity
//     const quantity = Number(quantity_product);

//     // Use provided date or current date
//     const saleDate = date ? new Date(date) : new Date();

//     // Fetch product prices
//     const [productRows] = await db.execute(
//       "SELECT sell_price, cost_price FROM products WHERE name = ? LIMIT 1",
//       [product_name]
//     );

//     if (productRows.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Product not found"
//       });
//     }

//     const { sell_price, cost_price } = productRows[0];

//     // Calculate totals and profit
//     const totalSales = sell_price * quantity;
//     const totalExpenses = cost_price * quantity;
//     const profit = totalSales - totalExpenses;

//     // Insert into profit_loss_summary
//     await db.execute(
//       `INSERT INTO profit_loss_summary 
//         (summary_date, fullname, product_name, quantity_product, sell_price, cost_price, total_sales, total_expenses, profit, created_at)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
//       [
//         saleDate,
//         fullname,
//         product_name,
//         quantity,
//         sell_price,
//         cost_price,
//         totalSales,
//         totalExpenses,
//         profit,
//       ]
//     );

//     return res.json({
//       success: true,
//       message: "Sale recorded successfully",
//       data: {
//         fullname,
//         product_name,
//         quantity,
//         sell_price,
//         cost_price,
//         totalSales,
//         totalExpenses,
//         profit,
//         saleDate,
//       },
//     });
//   } catch (err) {
//     console.error("Error in addSale:", err);
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error adding sale" });
//   }
// };

exports.addExpense = async (req, res) => {
  try {
    let { description, amount, date } = req.body;

    description = description?.trim();
    amount = Number(amount);

    if (!description || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Description and valid amount are required"
      });
    }

    const expenseDate = date 
      ? new Date(date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    console.log("Inserting expense:", description, amount, expenseDate);

    await db.execute(
      `INSERT INTO expenses (description, amount, date, created_at)
       VALUES (?, ?, ?, NOW())`,
      [description, amount, expenseDate]
    );

    res.json({ success: true, message: "Expense recorded successfully" });
  } catch (err) {
    console.error("Error in addExpense:", err);
    res.status(500).json({ success: false, message: "Server error while adding expense" });
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
exports.getAllDebts = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM debts ORDER BY issueDate DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching debts:", err);
    res.status(500).json({ success: false, message: "Server error fetching debts" });
  }
};
exports.addDebt = async (req, res) => {
  try {
    const { customer, contact, product, quantity, price, issueDate, dueDate, status } = req.body;
    const total = quantity * price;
    const balance = total;

    await db.execute(
      `INSERT INTO debts 
      (customer, contact, product, quantity, price, total, payments, balance, issueDate, dueDate, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW())`,
      [customer, contact, product, quantity, price, total, balance, issueDate, dueDate, status]
    );

    res.json({ success: true, message: "Debt added successfully" });
  } catch (err) {
    console.error("Error adding debt:", err);
    res.status(500).json({ success: false, message: "Server error adding debt" });
  }
};
exports.editDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const { customer, contact, product, quantity, price, issueDate, dueDate, status } = req.body;
    const total = quantity * price;

    // Update total and balance if necessary
    const [rows] = await db.execute('SELECT payments FROM debts WHERE id = ?', [id]);
    if(rows.length === 0) return res.status(404).json({ success: false, message: "Debt not found" });

    const payments = rows[0].payments;
    const balance = total - payments;

    await db.execute(
      `UPDATE debts SET customer=?, contact=?, product=?, quantity=?, price=?, total=?, balance=?, issueDate=?, dueDate=?, status=? WHERE id=?`,
      [customer, contact, product, quantity, price, total, balance, issueDate, dueDate, status, id]
    );

    res.json({ success: true, message: "Debt updated successfully" });
  } catch (err) {
    console.error("Error editing debt:", err);
    res.status(500).json({ success: false, message: "Server error editing debt" });
  }
};
exports.deleteDebt = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM debts WHERE id = ?', [id]);
    res.json({ success: true, message: "Debt deleted successfully" });
  } catch (err) {
    console.error("Error deleting debt:", err);
    res.status(500).json({ success: false, message: "Server error deleting debt" });
  }
};
exports.recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if(!amount || isNaN(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Invalid payment amount" });

    const [rows] = await db.execute('SELECT total, payments FROM debts WHERE id = ?', [id]);
    if(rows.length === 0) return res.status(404).json({ success: false, message: "Debt not found" });

    const newPayments = +rows[0].payments + +amount;
    const balance = rows[0].total - newPayments;
    const status = balance <= 0 ? "Paid" : (newPayments > 0 ? "Partially Paid" : "Unpaid");

    await db.execute('UPDATE debts SET payments=?, balance=?, status=? WHERE id=?', [newPayments, balance, status, id]);

    res.json({ success: true, message: "Payment recorded successfully" });
  } catch (err) {
    console.error("Error recording payment:", err);
    res.status(500).json({ success: false, message: "Server error recording payment" });
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
exports.getAgents = (req, res) => {
  res.render("agent");
} ;
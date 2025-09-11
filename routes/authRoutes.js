const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const multer = require('multer');
const path = require('path');

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../public/images')); // make sure folder exists
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage }); // <--- THIS IS THE DEFINED 'upload'









// Routes
router.get("/", authController.getLogin);
router.post("/login", authController.postLogin);

router.get("/forgot", authController.getForgot);
router.post("/forgot", authController.postForgot);

router.get("/dashboard", authController.getDashboard);
router.get("/logout", authController.logout);

router.get("/register", (req, res) => res.render("register", { message: "" }));
router.post("/register", authController.registerUser);

router.get("/shop", authController.getShop);
router.get('/shop', authController.getShopDashboard);

router.get('/products', authController.getAllProducts);
router.post('/products', upload.single('image'), authController.addProduct);
router.put('/products/:id', upload.single('image'), authController.updateProduct);
router.delete('/products/:id', authController.deleteProduct);
router.get('/products/:id', authController.getProductById);  // ✅ needed
router.get('/sales', authController.getAllSales);
router.post('/sales/add', authController.addSale);

router.get('/profit-loss', authController.getPL);
router.post('/add-sale', authController.addSale);
router.post('/add-expense', authController.addExpense);

router.get('/product-summary', authController.getStockStatus);












router.get("/shop/Home", authController.getHome);
router.get("/shop/product_management", authController.getProductManagement);
router.get("/shop/Sales", authController.getSales);
router.get("/shop/profite_loss", authController.getProfiteLoss);
router.get("/shop/Stock_status", authController.getStockStatus);
router.get("/shop/Analysis", authController.getAnalysis);
router.get("/shop/notification", authController.getNotification);
router.get("/shop/settings", authController.getSettings);
router.get("/shop/Debits", authController.getDebits);
router.get("/shop/Audit_logs", authController.getAuditLogs);
module.exports = router;

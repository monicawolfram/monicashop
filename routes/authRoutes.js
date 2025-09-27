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
router.get('/products/:id', authController.getProductById);  
router.post('/products', upload.single('image'), authController.addProduct);
router.put('/products/:id', upload.single('image'), authController.updateProduct);
router.delete('/products/:id', authController.deleteProduct);

router.get('/sales', authController.getAllSales);
router.post('/sales/add', authController.addSale);

router.get('/profit-loss', authController.getPL);
router.post('/add-sale', authController.addSales);
router.post('/add-expense', authController.addExpense);

router.get('/product-summary', authController.getStockStatus);

router.get('/all', authController.getAllDebts);
router.post('/add', authController.addDebt);
router.put('/edit/:id', authController.editDebt);
router.delete('/delete/:id', authController.deleteDebt);
router.put('/payment/:id', authController.recordPayment);


router.get('/all/bedsheets', authController.getAllBedsheets);
router.post('/add-bedsheets', authController.addBedsheet);
router.put('/edit-bedsheets/:id', authController.editBedsheet);
router.delete('/delete-bedsheets/:id', authController.deleteBedsheet);
router.post('/save-summary', authController.saveSummary);





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

router.get("/agent", authController.getAgents);
router.get("/agent/transactions", authController.getTransactions);
router.get("/agent/Customer", authController.getCustomer);
router.get("/agent/debts", authController.getDebts);
router.get("/agent/security", authController.getSecurity);
router.get("/agent/Settings1", authController.getSettings1);
router.get("/agent/logout", authController.logout);

router.get("/Bedsheets", authController.getBedsheets);
router.get("/Bedsheets/Bedsheet_management", authController.getBedsheetManagement);
router.get("/Bedsheets/Sales_bedsheets", authController.getSalesBedsheets);
router.get("/Bedsheets/Products_bedsheets", authController.getProductsBedsheets);
router.get("/Bedsheet/Reports_bedsheets", authController.getReportsBedsheets);
router.get("/Profile", authController.getProfile);
router.get("/setting", authController.getSetting);
router.get("/more", authController.getMore);

module.exports = router;

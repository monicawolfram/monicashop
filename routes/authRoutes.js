const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

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
router.post('/shop/add', authController.addProduct);
router.post('/shop/edit/:id', authController.editProduct);
router.get('/shop/delete/:id', authController.deleteProduct);








module.exports = router;

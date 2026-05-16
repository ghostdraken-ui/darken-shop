const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "shop123";

// ENSURE UPLOADS DIRECTORY EXISTS
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// DATABASE
mongoose.connect("mongodb://127.0.0.1:27017/darken shop");

// IMAGE STORAGE
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

// MODELS
const User = mongoose.model("User", {
  username: String,
  password: String
});

const Product = mongoose.model("Product", {
  name: String,
  price: Number,
  image: String,
  owner: String,
  reviews: []
});

// AUTH MIDDLEWARE
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({error: "No token provided"});

  try {
    const data = jwt.verify(token, SECRET);
    req.user = data;
    next();
  } catch (err) {
    res.status(401).json({error: "Invalid token"});
  }
}

// REGISTER
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({error: "Username and password required"});
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({error: "Username already exists"});
    }

    const hash = await bcrypt.hash(password, 10);
    await new User({
      username,
      password: hash
    }).save();

    res.json({message: "Registered successfully"});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Registration failed"});
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({error: "Username and password required"});
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({error: "Invalid credentials"});

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({error: "Invalid credentials"});

    const token = jwt.sign({ username: user.username }, SECRET);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Login failed"});
  }
});

// ADD PRODUCT
app.post("/add-product", auth, upload.single("image"), async (req, res) => {
  try {
    const { name, price } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({error: "Name and price required"});
    }

    if (!req.file) {
      return res.status(400).json({error: "Image file required"});
    }

    const product = new Product({
      name,
      price: parseFloat(price),
      image: req.file.filename,
      owner: req.user.username
    });

    await product.save();
    res.json({message: "Product added successfully"});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Failed to add product"});
  }
});

// GET PRODUCTS
app.get("/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// REVIEWS
app.post("/review/:id", auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    
    if (!rating || !comment) {
      return res.status(400).json({error: "Rating and comment required"});
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({error: "Product not found"});
    }

    product.reviews.push({
      user: req.user.username,
      rating,
      comment
    });

    await product.save();
    res.json({message: "Review added successfully"});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Failed to add review"});
  }
});

// PAYMENT (SIMULATED)
app.post("/pay", (req, res) => {
  res.send("Payment request sent");
});

// START SERVER
app.listen(3000, () => console.log("Server running"));
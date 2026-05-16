const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "shop123";

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

// AUTH
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.send("No token");

  try {
    const data = jwt.verify(token, SECRET);
    req.user = data;
    next();
  } catch {
    res.send("Invalid token");
  }
}

// REGISTER
app.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);

  await new User({
    username: req.body.username,
    password: hash
  }).save();

  res.send("Registered successfully");
});

// LOGIN
app.post("/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username });

  if (!user) return res.send("User not found");

  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.send("Wrong password");

  const token = jwt.sign({ username: user.username }, SECRET);
  res.json({ token });
});

// ADD PRODUCT
app.post("/add-product", auth, upload.single("image"), async (req, res) => {
  await new Product({
    name: req.body.name,
    price: req.body.price,
    image: req.file.filename,
    owner: req.user.username
  }).save();

  res.send("Product added");
});

// GET PRODUCTS
app.get("/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// REVIEWS
app.post("/review/:id", auth, async (req, res) => {
  const product = await Product.findById(req.params.id);

  product.reviews.push({
    user: req.user.username,
    rating: req.body.rating,
    comment: req.body.comment
  });

  await product.save();
  res.send("Review added");
});

// PAYMENT (SIMULATED)
app.post("/pay", (req, res) => {
  res.send("Payment request sent");
});

// START SERVER
app.listen(3000, () => console.log("Server running"));
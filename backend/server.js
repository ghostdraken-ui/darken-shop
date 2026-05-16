const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const uploadDir = path.join(__dirname, "uploads");
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const SECRET = "shop123";

// ENSURE UPLOADS DIRECTORY EXISTS
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// DATABASE
// Use a safe DB name (no spaces) so register + login hit the same DB.
mongoose.connect("mongodb://127.0.0.1:27017/darken_shop").then(async () => {
  console.log("Connected to MongoDB (darken_shop)");
  await ensureDefaultAdmin();
}).catch((err) => {
  console.error("MongoDB connection error:", err);
});

// IMAGE STORAGE
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

app.use("/uploads", express.static(uploadDir));
// MODELS
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  phone: String,
  isAdmin: {
    type: Boolean,
    default: false
  }
});

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  owner: String,
  reviews: []
});

const User = mongoose.model("User", userSchema);
const Product = mongoose.model("Product", productSchema);

async function ensureDefaultAdmin() {
  const adminExists = await User.exists({ isAdmin: true });
  if (adminExists) return;

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const existingAdminUser = await User.findOne({ username: adminUsername });

  if (existingAdminUser) {
    existingAdminUser.isAdmin = true;
    await existingAdminUser.save();
    console.log(`Admin user enabled: ${adminUsername}`);
    return;
  }

  const hash = await bcrypt.hash(adminPassword, 10);
  await new User({
    username: adminUsername,
    password: hash,
    isAdmin: true
  }).save();

  console.log(`Default admin created: ${adminUsername}`);
}

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

function adminOnly(req, res, next) {
  auth(req, res, async () => {
    try {
      const user = await User.findOne({ username: req.user.username });
      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      req.adminUser = user;
      next();
    } catch (err) {
      console.error("Admin auth error:", err);
      res.status(500).json({ error: "Failed to verify admin access" });
    }
  });
}

// REGISTER
app.post("/register", async (req, res) => {
  try {
    const { username, password, phone } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({error: "Username and password required"});
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({error: "Username already exists"});
    }

    const hash = await bcrypt.hash(password, 10);
    const isFirstUser = await User.countDocuments() === 0;
    await new User({
      username,
      password: hash,
      phone,
      isAdmin: isFirstUser
    }).save();

    res.json({message: "Registered successfully"});
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed", details: err.message });
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

    const token = jwt.sign({
      id: user._id,
      username: user.username,
      isAdmin: !!user.isAdmin
    }, SECRET);
    res.json({ token, username: user.username, isAdmin: !!user.isAdmin });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed", details: err.message });
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

// GET PRODUCTS ADDED BY THE LOGGED-IN USER
app.get("/my-products", auth, async (req, res) => {
  try {
    const products = await Product.find({ owner: req.user.username });
    res.json(products);
  } catch (err) {
    console.error("My products error:", err);
    res.status(500).json({ error: "Failed to load your products" });
  }
});

// REMOVE A PRODUCT ADDED BY THE LOGGED-IN USER
app.delete("/my-products/:id", auth, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      owner: req.user.username
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found for this user" });
    }

    await Product.findByIdAndDelete(product._id);

    if (product.image) {
      const imagePath = path.join(uploadDir, product.image);
      fs.unlink(imagePath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.error("Failed to remove product image:", err);
        }
      });
    }

    res.json({ message: "Product removed successfully" });
  } catch (err) {
    console.error("Remove my product error:", err);
    res.status(500).json({ error: "Failed to remove product" });
  }
});

// ADMIN: VIEW DATABASE DATA
app.get("/admin/data", adminOnly, async (req, res) => {
  try {
    const [users, products] = await Promise.all([
      User.find({}, "-password").lean(),
      Product.find().lean()
    ]);

    res.json({ users, products });
  } catch (err) {
    console.error("Admin data error:", err);
    res.status(500).json({ error: "Failed to load admin data" });
  }
});

// ADMIN: ADD USER
app.post("/admin/users", adminOnly, async (req, res) => {
  try {
    const { username, password, phone, isAdmin } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await new User({
      username,
      password: hash,
      phone,
      isAdmin: isAdmin === true
    }).save();

    res.json({
      message: "User added successfully",
      user: {
        _id: user._id,
        username: user.username,
        phone: user.phone,
        isAdmin: user.isAdmin
      }
    });
  } catch (err) {
    console.error("Admin add user error:", err);
    res.status(500).json({ error: "Failed to add user" });
  }
});

// ADMIN: RESET USER PASSWORD
app.put("/admin/users/:id/reset-password", adminOnly, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "New password is required" });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ message: `Password reset for ${user.username}` });
  } catch (err) {
    console.error("Admin reset password error:", err);
    res.status(500).json({ error: "Failed to reset user password" });
  }
});

// ADMIN: DELETE USER
app.delete("/admin/users/:id", adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isAdmin) {
      const adminCount = await User.countDocuments({ isAdmin: true });
      if (adminCount <= 1) {
        return res.status(400).json({ error: "You cannot delete the last admin user" });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    await Product.updateMany({ owner: user.username }, { owner: "deleted user" });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Admin delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ADMIN: DELETE PRODUCT
app.delete("/admin/products/:id", adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.image) {
      const imagePath = path.join(uploadDir, product.image);
      fs.unlink(imagePath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.error("Failed to remove product image:", err);
        }
      });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Admin delete product error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
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

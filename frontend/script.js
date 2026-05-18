const CART_KEY = 'myshopCart';
const productsEl = document.getElementById("products");
const searchInput = document.getElementById("searchInput");
const productStatus = document.getElementById("productStatus");

let cart = loadCart();
let allProducts = [];

function loadCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (err) {
        return [];
    }
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function imageSrc(image) {
    const value = String(image || '').trim();

    if (!value) {
        return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22 viewBox=%220 0 300 200%22%3E%3Crect width=%22300%22 height=%22200%22 fill=%22%23eadcf5%22/%3E%3Ctext x=%22150%22 y=%22106%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2216%22 fill=%22%2367447c%22%3ENo image%3C/text%3E%3C/svg%3E';
    }

    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
        return encodeURI(value);
    }

    return `/uploads/${encodeURIComponent(value)}`;
}

function productKey(product) {
    return product._id || `${product.name || 'product'}-${product.owner || 'seller'}-${product.price || 0}`;
}

fetch("/products")
.then(res => res.json())
.then(products => {
    allProducts = products;
    renderProducts(allProducts);
})
.catch(err => {
    console.error(err);
    productStatus.textContent = "Failed to load products.";
});

function renderProducts(products) {
    productsEl.innerHTML = "";

    if (!products.length) {
        productStatus.textContent = searchInput.value.trim()
            ? "No products match your search."
            : "No products available.";
        return;
    }

    productStatus.textContent = "";

    products.forEach((p, index) => {
        const reviewKey = productKey(p);

        productsEl.innerHTML += `
            <div class="product">
                <img src="${escapeHtml(imageSrc(p.image))}" alt="${escapeHtml(p.name)}">
                <h3>${escapeHtml(p.name)}</h3>
                <p><b>KES ${Number(p.price || 0)}</b></p>
                <p>Seller: ${escapeHtml(p.owner)}</p>

                <a class="details-link" href="review.html?product=${encodeURIComponent(reviewKey)}">
                    View Details
                </a>
                <button type="button" data-index="${index}">
                    Add to Cart
                </button>
            </div>
        `;
    });

    document.querySelectorAll(".product button").forEach(button => {
        button.addEventListener("click", () => addToCart(products[button.dataset.index]));
    });
}

function searchProducts() {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
        renderProducts(allProducts);
        return;
    }

    const filteredProducts = allProducts.filter(product => {
        const name = String(product.name || "").toLowerCase();
        const owner = String(product.owner || "").toLowerCase();
        const price = String(product.price || "").toLowerCase();

        return name.includes(query) || owner.includes(query) || price.includes(query);
    });

    renderProducts(filteredProducts);
}

searchInput.addEventListener("input", searchProducts);

function addToCart(p){
    cart.push({
        _id: p._id,
        name: p.name,
        price: Number(p.price) || 0,
        image: p.image,
        owner: p.owner
    });
    saveCart();
    alert("Product added to cart");
}

function checkout(){
    if (!cart.length) {
        alert("Your cart is empty");
        return;
    }

    fetch("/pay", {
        method: "POST"
    })
    .then(res => res.text())
    .then(message => {
        alert(message || "Payment successful");
        cart = [];
        saveCart();
    })
    .catch(err => {
        console.error(err);
        alert("Payment failed");
    });
}

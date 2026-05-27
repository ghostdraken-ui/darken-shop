const CART_KEY = 'myshopCart';
const productsEl = document.getElementById("products");
const searchInput = document.getElementById("searchInput");
const productStatus = document.getElementById("productStatus");
const adminDashboardLink = document.getElementById("adminDashboardLink");

let cart = loadCart();
let allProducts = [];

if (adminDashboardLink && localStorage.getItem("token") && localStorage.getItem("isAdmin") === "true") {
    adminDashboardLink.hidden = false;
}

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

function stockQuantity(product) {
    return Math.max(0, Number(product.quantity) || 0);
}

function cartItemQuantity(item) {
    return Math.max(1, Number(item.cartQuantity) || 1);
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
        const stock = stockQuantity(p);
        const quantityInputId = `productQuantity-${index}`;

        productsEl.innerHTML += `
            <div class="product">
                <img src="${escapeHtml(imageSrc(p.image))}" alt="${escapeHtml(p.name)}">
                <h3>${escapeHtml(p.name)}</h3>
                <p><b>KES ${Number(p.price || 0)}</b></p>
                <p>Seller: ${escapeHtml(p.owner)}</p>
                <p>Available: ${escapeHtml(stock)}</p>

                <a class="details-link" href="review.html?product=${encodeURIComponent(reviewKey)}">
                    View Details
                </a>
                <label class="quantity-control" for="${quantityInputId}">
                    Quantity
                    <input id="${quantityInputId}" type="number" min="1" max="${escapeHtml(stock)}" value="${stock > 0 ? 1 : 0}" ${stock <= 0 ? 'disabled' : ''}>
                </label>
                <button type="button" data-index="${index}" ${stock <= 0 ? 'disabled' : ''}>
                    Add to Cart
                </button>
            </div>
        `;
    });

    document.querySelectorAll(".product button").forEach(button => {
        button.addEventListener("click", () => {
            const quantityInput = document.getElementById(`productQuantity-${button.dataset.index}`);
            addToCart(products[button.dataset.index], Number(quantityInput.value));
        });
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
        const quantity = String(product.quantity || "").toLowerCase();

        return name.includes(query) || owner.includes(query) || price.includes(query) || quantity.includes(query);
    });

    renderProducts(filteredProducts);
}

searchInput.addEventListener("input", searchProducts);

function addToCart(p, requestedQuantity = 1){
    const stock = stockQuantity(p);
    const quantity = Math.floor(Number(requestedQuantity) || 0);

    if (stock <= 0) {
        alert("This product is out of stock");
        return;
    }

    if (quantity < 1 || quantity > stock) {
        alert(`Choose a quantity between 1 and ${stock}`);
        return;
    }

    const key = productKey(p);
    const existing = cart.find(item => productKey(item) === key);

    if (existing) {
        const nextQuantity = cartItemQuantity(existing) + quantity;

        if (nextQuantity > stock) {
            alert(`Only ${stock} available`);
            return;
        }

        existing.cartQuantity = nextQuantity;
        existing.stockQuantity = stock;
    } else {
        cart.push({
        _id: p._id,
        name: p.name,
        price: Number(p.price) || 0,
        image: p.image,
            owner: p.owner,
            cartQuantity: quantity,
            stockQuantity: stock
        });
    }

    saveCart();
    alert(`${quantity} product${quantity === 1 ? '' : 's'} added to cart`);
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

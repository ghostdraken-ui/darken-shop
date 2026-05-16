let cart = [];

fetch("http://localhost:3000/products")
.then(res => res.json())
.then(products => {
    products.forEach(p => {
        document.getElementById("products").innerHTML += `
            <div class="product">
                <img src="http://localhost:3000/uploads/${p.image}">
                <h3>${p.name}</h3>
                <p><b>KES ${p.price}</b></p>
                <p>Seller: ${p.owner}</p>

                <button onclick='addToCart(${JSON.stringify(p)})'>
                    Add to Cart
                </button>
            </div>
        `;
    });
});

function addToCart(p){
    cart.push(p);
    updateCart();
}

function updateCart(){
    let total = 0;
    let html = "";

    cart.forEach(i => {
        total += i.price;
        html += `<li>${i.name} - ${i.price}</li>`;
    });

    document.getElementById("cart").innerHTML = html;
    document.getElementById("total").innerHTML = "Total: KES " + total;
}

function checkout(){
    fetch("http://localhost:3000/pay", {
        method: "POST"
    })
    .then(res => res.json())
    .then(data => alert(data.message || "Payment successful"))
    .catch(err => {
        console.error(err);
        alert("Payment failed");
    });
}
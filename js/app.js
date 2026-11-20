$(function () {
    const PAGE_SIZE = 8;
  let currentUser = null, currentProfile = null, isAdmin = false;
  let products = [], categories = [], cart = JSON.parse(localStorage.getItem("novamart_cart") || "[]");
  let productPage = 1, authMode = "login", adminTab = "overview", editingProductId = null;
  const money = n => "₹" + Number(n || 0).toFixed(2);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = msg => { $("#toast").text(msg).stop(true,true).fadeIn(150); setTimeout(()=>$("#toast").fadeOut(250),3000); };
  const ready = () => { if (!firebaseReady) { toast("Add your Firebase configuration in shared/firebase-config.js first."); return false; } return true; };
  const showPage = page => { $(".page").attr("hidden",true); $("#" + page + "Page").removeAttr("hidden"); $("nav a").removeClass("active"); $(`nav a[data-page="${page}"]`).addClass("active"); };
  const persistCart = () => { localStorage.setItem("novamart_cart",JSON.stringify(cart)); $("#cartCount").text(cart.reduce((a,x)=>a+x.qty,0)); };
  const moneyDate = ts => ts && ts.toDate ? ts.toDate().toLocaleString() : (ts ? new Date(ts).toLocaleString() : "—");
  const asDate = d => new Date(d + "T00:00:00");
  const getCartProduct = id => products.find(p=>p.id===id);

  function renderProducts() {
    const q = ($("#searchInput").val()||"").toLowerCase(), cat=$("#categoryFilter").val(), sort=$("#sortFilter").val();
    let list=products.filter(p=>(!cat||p.categoryId===cat)&&(!q||`${p.title} ${p.description}`.toLowerCase().includes(q)));
    if(sort==="price-low") list.sort((a,b)=>a.price-b.price);
    if(sort==="price-high") list.sort((a,b)=>b.price-a.price);
    if(sort==="name") list.sort((a,b)=>(a.title||"").localeCompare(b.title||""));
    if(sort==="newest") list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE)); productPage=Math.min(productPage,pages);
    const visible=list.slice((productPage-1)*PAGE_SIZE,productPage*PAGE_SIZE);
    $("#productGrid").html(visible.length?visible.map(p=>`<article class="product-card">
      <div class="product-image">${p.imageUrl?`<img src="${esc(p.imageUrl)}" alt="${esc(p.title)}" loading="lazy">`:"◇"}</div>
      <div class="product-info"><small class="muted">${esc(categories.find(c=>c.id===p.categoryId)?.name||"Product")}</small>
      <h3>${esc(p.title)}</h3><p>${esc(p.description||"Discover this product.")}</p>
      <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="btn btn-primary add-cart" data-id="${esc(p.id)}" ${Number(p.quantity)<=0?"disabled":""}>Add</button></div>
      <small class="stock">${Number(p.quantity)>0?`${p.quantity} in stock`:"Out of stock"}</small></div></article>`).join(""):'<div class="empty-state">No products found. Add products in the Admin portal.</div>');
    $("#pageInfo").text(`Page ${productPage} of ${pages}`); $("#prevProducts").prop("disabled",productPage<=1); $("#nextProducts").prop("disabled",productPage>=pages);
  }

  //Events
  $("#searchInput,#categoryFilter,#sortFilter").on("input change",()=>{productPage=1;renderProducts();});
  $("#prevProducts").on("click",()=>{productPage=Math.max(1,productPage-1);renderProducts();});$("#nextProducts").on("click",()=>{productPage++;renderProducts();});
  
})
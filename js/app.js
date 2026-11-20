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

  async function loadCategories() {
    if (!ready()) return;
    const snap = await db.collection("categories").orderBy("name").get();
    categories = snap.docs.map(d=>({id:d.id,...d.data()}));
    $("#categoryFilter").html('<option value="">All categories</option>'+categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join(""));
  }
  async function loadProducts() {
    if (!ready()) { renderProducts(); return; }
    try {
      const snap = await db.collection("products").where("active","==",true).get();
      products = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderProducts();
    } catch(e) { console.error(e); toast("Could not load products. Check Firestore rules."); }
  }
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
  function renderCart() {
    persistCart(); let total=0;
    $("#cartItems").html(cart.length?cart.map(item=>{const p=getCartProduct(item.id)||item;const line=Number(p.price)*item.qty;total+=line;return `<div class="cart-row"><div><h3>${esc(p.title)}</h3><small>${money(p.price)} each</small></div><div class="qty-control"><button class="qty-minus" data-id="${esc(item.id)}">−</button><b>${item.qty}</b><button class="qty-plus" data-id="${esc(item.id)}">+</button></div><strong>${money(line)}</strong><button class="btn btn-danger remove-cart" data-id="${esc(item.id)}">Remove</button></div>`}).join(""):'<div class="empty-state">Your cart is empty.</div>');
    $("#cartSubtotal").text(money(total)); $("#cartItemsCount").text(cart.reduce((a,x)=>a+x.qty,0));
  }
  function addToCart(id) {
    const p=products.find(x=>x.id===id); if(!p)return;
    const found=cart.find(x=>x.id===id), next=(found?.qty||0)+1;
    if(next>Number(p.quantity||0)){toast("Not enough stock available.");return;}
    if(found)found.qty=next;else cart.push({id,qty:1,title:p.title,price:p.price});
    renderCart();toast("Added to cart.");
  }
  async function loadOrders() {
    if(!currentUser){$("#ordersList").html('<p class="muted">Please sign in to view your orders.</p>');return;}
    try { const snap=await db.collection("orders").where("customerId","==",currentUser.uid).get();
      const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      $("#ordersList").html(rows.length?`<div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Payment</th><th>Total</th><th>Status</th><th>Bill</th></tr></thead><tbody>${rows.map(o=>`<tr><td>${esc(o.id.slice(0,8))}</td><td>${moneyDate(o.createdAt)}</td><td>${o.items?.length||0}</td><td>${esc(o.paymentMethod)}</td><td>${money(o.total)}</td><td>${esc(o.status||"Placed")}</td><td><button class="btn btn-light bill-btn" data-id="${esc(o.id)}">View</button></td></tr>`).join("")}</tbody></table></div>`:'<div class="empty-state">No orders yet.</div>');
    } catch(e){console.error(e);toast("Unable to load orders.");}
  }
  function showBill(order) {
    const lines=(order.items||[]).map(i=>`${i.title} × ${i.qty} = ${money(i.price*i.qty)}`).join("\n");
    const body=`SHOPSPHERE - BILL\nOrder: ${order.id}\nDate: ${moneyDate(order.createdAt)}\n\n${lines}\n\nTotal: ${money(order.total)}\nPayment: ${order.paymentMethod}`;
    const w=window.open("","_blank"); if(!w){toast("Allow pop-ups to view the bill.");return;}
    w.document.write(`<pre style="font:14px/1.7 monospace;white-space:pre-wrap;padding:30px">${esc(body)}</pre><button onclick="window.print()">Print bill</button>`);
    w.document.close();
  }

  async function checkout() {
    if(!currentUser){toast("Please sign in before checkout.");$("#authModal").removeAttr("hidden");return;}
    if(!cart.length){toast("Your cart is empty.");return;}
    const method=$("#paymentMethod").val();
    try {
      await db.runTransaction(async tx=>{
        const userRef=db.collection("users").doc(currentUser.uid), userSnap=await tx.get(userRef);
        if(!userSnap.exists)throw new Error("Customer profile was not found.");
        const profile=userSnap.data(), total=cart.reduce((sum,i)=>sum+Number((getCartProduct(i.id)||i).price)*i.qty,0);
        if(method==="credit" && (Number(profile.creditLimit||0)-Number(profile.creditUsed||0))<total)throw new Error("Insufficient available credit. Ask the administrator to increase your limit.");
        const refs=cart.map(i=>({item:i,ref:db.collection("products").doc(i.id)}));
        const snapshots=[]; for(const x of refs)snapshots.push(await tx.get(x.ref));
        snapshots.forEach((snap,index)=>{if(!snap.exists||snap.data().active!==true||Number(snap.data().quantity)<refs[index].item.qty)throw new Error("A product is unavailable or stock has changed. Refresh and try again.");});
        const orderRef=db.collection("orders").doc();
        const orderItems=refs.map((x,i)=>{const p=snapshots[i].data();return {productId:x.item.id,title:p.title,price:Number(p.price),qty:x.item.qty};});
        const amount=orderItems.reduce((s,i)=>s+i.price*i.qty,0);
        refs.forEach((x,i)=>tx.update(x.ref,{quantity:firebase.firestore.FieldValue.increment(-x.item.qty),updatedAt:firebase.firestore.FieldValue.serverTimestamp()}));
        if(method==="credit")tx.update(userRef,{creditUsed:firebase.firestore.FieldValue.increment(amount),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
        tx.set(orderRef,{customerId:currentUser.uid,customerName:profile.name||currentUser.email,customerEmail:currentUser.email,items:orderItems,total:amount,paymentMethod:method,status:"Placed",createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      });
      cart=[];renderCart();$("#checkoutModal").attr("hidden",true);toast("Order placed successfully.");await loadProducts();await loadOrders();showPage("orders");
    } catch(e){console.error(e);toast(e.message||"Checkout failed.");}
  }

  function authModal(mode) {
    authMode=mode; $("#authTitle").text(mode==="signup"?"Create account":"Sign in"); $("#authSubmit").text(mode==="signup"?"Create account":"Sign in");
    $("#nameField,#mobileField").prop("hidden",mode!=="signup");$("#toggleAuth").text(mode==="signup"?"Already have an account? Sign in":"Create an account");
    $("#resetPassword").toggle(mode==="login");$("#authPassword").val("");$("#authModal").removeAttr("hidden");
  }
  async function handleAuth(e) {
    e.preventDefault();if(!ready())return;
    const email=$("#authEmail").val().trim(),password=$("#authPassword").val();
    try {
      if(authMode==="signup"){
        const cred=await auth.createUserWithEmailAndPassword(email,password);
        await db.collection("users").doc(cred.user.uid).set({name:$("#authName").val().trim(),email,mobile:$("#authMobile").val().trim(),role:"customer",creditLimit:0,creditUsed:0,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      } else await auth.signInWithEmailAndPassword(email,password);
      $("#authModal").attr("hidden",true);toast("Welcome!");$("#authForm")[0].reset();
    } catch(e){toast(e.message);}
  }
  async function onAuth(user) {
    currentUser=user;currentProfile=null;isAdmin=false;
    if(user){try{const doc=await db.collection("users").doc(user.uid).get();currentProfile=doc.exists?doc.data():{};isAdmin=currentProfile.role==="admin";}catch(e){console.error(e);}}
    $("#userLabel").text(user?(currentProfile?.name||user.email):"Guest");$("#loginButton").prop("hidden",!!user);$("#logoutButton").prop("hidden",!user);$("#adminNav").prop("hidden",!isAdmin);
    if(!user && !$("#adminPage").attr("hidden"))showPage("shop");
    if(!user)$("#ordersList").html('<p class="muted">Sign in to view your orders.</p>');
    if(isAdmin && !$("#adminPage").attr("hidden"))renderAdmin();
    if(user)loadOrders();
  }

  //Events
  $("nav a,.brand").on("click",function(e){e.preventDefault();const p=$(this).data("page");if(p==="admin"&&!isAdmin){toast("Administrator access required.");return;}if(p==="admin"){showPage("admin");renderAdmin();}else if(p==="orders"){showPage("orders");loadOrders();}else showPage("shop");});
  $("#cartButton").on("click",()=>{renderCart();showPage("cart");});
  $("#loginButton").on("click",()=>authModal("login"));$("#logoutButton").on("click",()=>auth.signOut());
  $("#authForm").on("submit",handleAuth);$("#toggleAuth").on("click",()=>authModal(authMode==="login"?"signup":"login"));
  $("#resetPassword").on("click",async()=>{const email=$("#authEmail").val().trim();if(!email){toast("Enter your email address first.");return;}try{await auth.sendPasswordResetEmail(email);toast("Password reset email sent.");}catch(e){toast(e.message);}});
  $("[data-close]").on("click",function(){$("#"+$(this).data("close")).attr("hidden",true);});
  $("#searchInput,#categoryFilter,#sortFilter").on("input change",()=>{productPage=1;renderProducts();});
  $("#prevProducts").on("click",()=>{productPage=Math.max(1,productPage-1);renderProducts();});$("#nextProducts").on("click",()=>{productPage++;renderProducts();});
  $(document).on("click",".add-cart",function(){addToCart($(this).data("id"));});
  $(document).on("click",".remove-cart",function(){cart=cart.filter(x=>x.id!==$(this).data("id"));renderCart();});
  $(document).on("click",".qty-minus,.qty-plus",function(){const id=$(this).data("id"),it=cart.find(x=>x.id===id),p=getCartProduct(id)||it;if($(this).hasClass("qty-minus"))it.qty--;else if(it.qty<Number(p.quantity||0))it.qty++;else toast("Available stock limit reached.");cart=cart.filter(x=>x.qty>0);renderCart();});
  $("#checkoutButton").on("click",()=>{if(!cart.length){toast("Your cart is empty.");return;}const total=cart.reduce((s,i)=>s+Number((getCartProduct(i.id)||i).price)*i.qty,0);$("#checkoutDetails").html(`<p>${cart.reduce((s,i)=>s+i.qty,0)} item(s) · <strong>${money(total)}</strong></p>`);$("#creditHint").text(currentProfile?`Available credit: ${money(Number(currentProfile.creditLimit||0)-Number(currentProfile.creditUsed||0))}`:"Sign in to see your credit balance.");$("#checkoutModal").removeAttr("hidden");});
  $("#checkoutForm").on("submit",e=>{e.preventDefault();checkout();});
  $("#paymentMethod").on("change",function(){$("#creditHint").toggle($(this).val()==="credit");});
  $(document).on("click",".bill-btn",async function(){const d=await db.collection("orders").doc($(this).data("id")).get();if(d.exists)showBill({id:d.id,...d.data()});});
  $(document).on("click","[data-admin-tab]",function(){adminTab=$(this).data("admin-tab");renderAdmin();});
  if(firebaseReady){auth.onAuthStateChanged(onAuth);loadCategories().then(loadProducts).catch(e=>console.error(e));}
  else {renderProducts();toast("Setup required: configure Firebase to activate the application.");}
  persistCart();renderCart();
})
# NovaMart — E-Commerce Web Application

NovaMart is a browser-based e-commerce application with separate **Customer** and **Administrator** experiences. The frontend uses **HTML, CSS, JavaScript, and jQuery**. The current REST-based implementation uses **Axios** to communicate with **Firebase Authentication** and **Cloud Firestore** over HTTPS, without loading the Firebase JavaScript SDK.

> **Project status:** The Axios migration has passed JavaScript syntax checks, but has **not** been verified end-to-end against the live Firebase project. In particular, cash checkout has returned HTTP **403**, and admin product creation/editing has returned HTTP **400**. These issues must be resolved before the application is considered production-ready.

## Features

### Customer portal

- Browse active products with images, prices, descriptions, and stock availability.
- Search, filter by category, sort, and paginate products.
- Register, sign in, sign out, and request a password-reset email.
- Add products to a cart and adjust quantities.
- Place orders using **cash** or **customer credit** as the selected payment method.
- View order history and printable order bills.

**Payment note:** Cash and credit are application-level payment methods. The code does not integrate a payment gateway or process real card/bank transactions. Credit availability is based on the customer's Firestore profile.

### Administrator portal

- View product, category, customer, and order summaries.
- Create, edit, activate/deactivate, and delete products.
- Manage categories and customer credit limits.
- Review orders and change fulfillment status.
- Inspect inventory and generate date-range sales reports.

**Access note:** Administrator access depends on a user's `role` field being `admin` in the Firestore `users` collection and on Firestore Security Rules. Public sign-up creates a customer account, not an administrator account.

## Technology stack

| Layer | Technology |
| --- | --- |
| Structure | HTML5 |
| Styling | CSS3 |
| Client-side behavior | JavaScript |
| DOM and event handling | jQuery |
| HTTP client | Axios |
| Authentication backend | Firebase Authentication REST API |
| Database backend | Cloud Firestore REST API |
| Hosting / automation | GitHub Pages and GitHub Actions |

## Project structure

```text
ECommerce-NovaMart/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   └── rest-api.js
├── shared/
│   └── firebase-config.js
├── .github/
│   └── workflows/
│       ├── validate.yml
│       └── deploy.yml
└── README.md
```

Additional configuration files may be present in the repository.

## How the Axios integration works

```text
Browser UI (index.html)
       ↓
Application logic (js/app.js)
       ↓
REST client (js/rest-api.js)
       ↓
Axios HTTPS requests
       ↓
Firebase Authentication REST / Cloud Firestore REST
       ↓
Firebase services
```

`app.js` uses methods such as `api.collection("products").get()`; these are **project-defined methods**, not Firebase SDK calls. The methods are implemented in `rest-api.js` using Axios requests. The REST client also handles Firebase ID tokens and token refresh.

The application uses REST operations for document reads and writes and uses Firestore REST transaction endpoints for checkout. The transaction code should be tested carefully under concurrent orders and permission restrictions.

## Getting started

### Prerequisites

- A modern web browser.
- VS Code with Live Server, or another local static HTTP server.
- A Firebase project with **Authentication** and **Cloud Firestore** configured.
- Email/password sign-in enabled in Firebase Authentication.
- Appropriate Firestore Security Rules for customer and administrator operations.

### 1. Clone the repository

```bash
git clone https://github.com/GUG-2005/ECommerce-NovaMart.git
cd ECommerce-NovaMart
```

If your repository URL is different, use your actual GitHub URL.

### 2. Configure Firebase

Open `shared/firebase-config.js` and supply the Firebase **web app configuration** for your project, including `apiKey`, `authDomain`, and `projectId` (and any other fields present in the configuration object).

Obtain these values from **Firebase Console → Project settings → Your apps → Web app configuration**.

The Firebase web API key identifies the project; it is **not** a service-account private key. Never place service-account credentials or other privileged secrets in frontend files.

### 3. Confirm script loading order

Near the end of `index.html`, the relevant scripts should load in this order:

```html
<script src="https://cdn.jsdelivr.net/npm/axios@1.7.9/dist/axios.min.js"></script>
<script src="shared/firebase-config.js"></script>
<script src="js/rest-api.js"></script>
<script src="js/app.js"></script>
```

jQuery is also loaded by `index.html` before `app.js`.

### 4. Run locally

Serve the repository root using **VS Code Live Server** or another local HTTP server, then open the URL provided by that server. Avoid opening `index.html` directly with the `file://` protocol.

### 5. Create an administrator account

Register a normal user, then have an authorized project administrator assign `role: "admin"` to that user's Firestore profile using a trusted administrative process. **Do not** allow users to choose the administrator role during public sign-up.

## Firestore collections

The application uses the following collections:

| Collection | Purpose |
| --- | --- |
| `categories` | Category names and identifiers |
| `products` | Product details, prices, stock quantities, and active status |
| `users` | Customer profiles, roles, and credit information |
| `orders` | Customer orders, purchased items, payment method, totals, and status |

Product documents reference categories using `categoryId`. Order documents reference customers using `customerId`.

## Security considerations

- **Keep Firestore Security Rules enabled.** Do not use `allow read, write: if true` to bypass errors.
- Customer and administrator access must be enforced by Firestore rules, not only by hiding UI elements.
- Browser-side stock and credit updates are sensitive. For production use, consider moving checkout and credit accounting to a trusted backend, such as Cloud Functions, with server-side validation and an audit trail.
- Serve the site over HTTPS in production and avoid exposing authentication tokens through logs or untrusted scripts.
- The browser stores authentication session information locally; protect against cross-site scripting and review this storage approach before production use.

## GitHub Actions and deployment

The repository includes two workflow files:

- `.github/workflows/validate.yml` — validation checks for the project.
- `.github/workflows/deploy.yml` — publishes the static website to GitHub Pages after validation, according to its configured triggers.

To deploy, open **GitHub → Settings → Pages** and select **GitHub Actions** as the deployment source. Confirm that `deploy.yml` copies `js/rest-api.js`, `js/app.js`, `shared/firebase-config.js`, `index.html`, and the CSS assets into the published site.

GitHub Pages hosts the frontend only; Firebase provides authentication and data services.

## Testing checklist

- [ ] Products and categories load from Firestore.
- [ ] Search, filters, sorting, pagination, and cart controls work.
- [ ] Customer sign-up, sign-in, sign-out, and password reset work.
- [ ] Customer order history loads.
- [ ] Cash checkout creates an order and decrements stock atomically.
- [ ] Credit checkout validates available credit and updates balances correctly.
- [ ] Administrator product creation, editing, and deletion work.
- [ ] Category management, customer credit limits, and order status changes work.
- [ ] Inventory and date-range reports display accurate results.
- [ ] GitHub Actions validation and Pages deployment succeed.

### Known issues under investigation

The current Axios REST migration has encountered:

1. **HTTP 403 during cash checkout** — investigate the failing Firestore transaction request and security-rule evaluation.
2. **HTTP 400 during administrator product creation/editing** — inspect the Firestore REST error response and the write payload in `js/rest-api.js`.

To diagnose these issues, open browser Developer Tools → **Network → Fetch/XHR**, repeat the action, and inspect the failed request's **Response** body. A successful JavaScript syntax check does not establish that the REST operations work correctly.

## Future improvements

- Complete end-to-end testing of the Axios REST migration.
- Add server-side checkout and credit validation for production use.
- Improve error messages and loading states.
- Add automated integration tests and deployment smoke tests.

## License

No license is specified in this README. Add a `LICENSE` file if you intend to grant others permission to reuse or distribute the project.

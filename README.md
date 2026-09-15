# eFancy2026

## Multi-Service Ordering & Pre-Ordering Platform

eFancy2026 is a full-stack, mobile-first ordering platform designed to support
multiple consumer services through a unified application and backend architecture.

The platform currently covers three major service areas:

- user registration, login and user management
- product adding and management
- vendor adding and management
- shopping cart management and payment process
- 🍽️ **eSpectacles** — Self-ordering for spectacle frame and lens
- 🛒 **eGroceries** — Grocery browsing and ordering
- 🥬 **eFreshes** — Fresh food and produce browsing and pre-ordering

eSpectacles, eGroceries and eFreshes pre-ordering workflows are substantially implemented,
while the platform continues to evolve with additional functionality and service
categories.

The project demonstrates full-stack application development, REST API design,
authentication and authorization, order workflow management, database persistence,
responsive UI development, and AI-assisted software engineering.

---

## Key Features

### Multi-Service Architecture

eFancy2026 is designed as an extensible platform rather than a single-purpose
ordering application.

Different service domains share common infrastructure such as:

- User authentication
- Role-based authorization
- Product and category management
- Shopping/order workflows
- Database persistence
- Administrative functions
- REST API communication

This allows new service categories to be introduced without rebuilding the
entire application architecture.

---

## 🍽️ eSpectacles — Self-Ordering

eSpectacles provides a self-ordering workflow designed for spectacle frame and lens
scenarios.

Key capabilities include:

- frames/lens browsing
- Item selection
- Order creation
- Order status management
- Mobile-first ordering interface
- User authentication
- Administrative management

The workflow is designed to provide a simple ordering experience while sharing
the same backend services and authentication infrastructure used by other
eFancy services.

---

## 🛒 eGroceries — Grocery Ordering

eGroceries extends the platform into grocery ordering.

The pre-ordering workflow is substantially implemented and includes:

- Grocery product browsing
- Category and sub-category navigation
- Product selection
- Order creation
- Order management
- Order payment and status management
- User authentication and authorization
- Mobile-friendly user interface

The architecture reuses common platform capabilities while allowing
grocery-specific workflows to evolve independently.

---

## 🥬 eFreshes — Fresh Product Pre-Ordering

eFreshes provides pre-ordering functionality for fresh food and produce.

The workflow is substantially implemented and includes:

- Fresh product browsing
- Category-based navigation
- Product selection
- Cutting options
- Packaging options
- Pre-order creation
- Order management
- Authentication and authorization
- Mobile-first interface

eFreshes demonstrates how the common eFancy architecture can support another
business domain without duplicating the complete application stack.

---

## Authentication & Authorization

The backend implements authentication using **JSON Web Tokens (JWT)**.

Role-Based Access Control (**RBAC**) is used to separate permissions between
different types of users.

Authentication and authorization functionality includes:

- User registration
- User login
- JWT-based authentication
- Protected API endpoints
- Role-based access control
- Administrative authorization

This allows the same backend to support both customer-facing and
administrative functionality.

---

## Order Workflow

The platform provides structured order-management workflows rather than simply
storing shopping-cart data.

Typical workflow:

```text
Browse Products
      ↓
Select Items
      ↓
Create Order / Pre-Order
      ↓
Order Processing
      ↓
Order Status Updates
      ↓
Completion
```

The workflow architecture is designed so that different service domains can
extend their ordering behavior while continuing to use shared platform
infrastructure.

---

## Technology Stack

### Frontend

- React
- Vite
- JavaScript
- HTML5
- CSS
- Responsive / mobile-first UI

### Backend

- Node.js
- Express.js
- REST APIs
- JWT authentication
- Role-Based Access Control (RBAC)

### Database

- SQLite

### Development

- Git
- GitHub
- GitHub Copilot
- AI-assisted software development

---

## Architecture

The application follows a client/server architecture:

```text
┌───────────────────────────────────────────────┐
│              React / Vite Web UI              │
│                                               │
│   eSpectacles    eGroceries      eFreshes     │
└──────────────────────┬────────────────────────┘
                       │
                       │ REST API
                       ▼
┌───────────────────────────────────────────────┐
│             Node.js / Express API             │
│                                               │
│  Authentication │ RBAC │ Orders │ Products    │
│  Categories     │ Users │ Administration      │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│                    SQLite                     │
│                                               │
│ Users │ Products │ Categories │ Orders │ ...  │
└───────────────────────────────────────────────┘
```

The architecture separates frontend, backend, and persistence concerns while
allowing multiple service domains to share common application services.

---

## Project Structure

```text
eFancy2026/
│
├── backend/
│   ├── authentication
│   ├── configuration
│   ├── database access
│   ├── API routes
│   └── business logic
│
├── web/
│   ├── React application
│   ├── components
│   ├── pages
│   └── frontend services
│
├── scripts/
│   └── development / utility scripts
│
├── data.sqlite
│
└── README.md
```

> The exact internal structure may evolve as the application is refactored
> and additional functionality is introduced.

---

## Running the Project

### Prerequisites

Install:

- Node.js
- npm
- Git

Clone the repository:

```bash
git clone https://github.com/Danny87Chew/eFancy2026.git
cd eFancy2026
```

### Backend

Navigate to the backend directory:

```bash
cd backend
npm install
```

Start the backend using the appropriate npm script configured in
`package.json`.

For example:

```bash
npm start
```

or, for development:

```bash
npm run dev
```

### Frontend

Open another terminal:

```bash
cd web
npm install
npm run dev
```

Vite will display the local development URL after startup.

> Check the project's `package.json` files for the currently configured
> development and production commands.

---

## Development Approach

This project is being developed incrementally.

Instead of creating separate applications for dining, groceries, and fresh
products, the architecture focuses on identifying reusable platform
capabilities and extending them for different service domains.

The development process includes:

1. Define business requirements and user workflows
2. Design reusable frontend and backend components
3. Implement REST API functionality
4. Implement database persistence
5. Build mobile-first user interfaces
6. Test end-to-end workflows
7. Refactor common functionality
8. Extend the platform to additional service domains

This approach allows the project to evolve from an initial self-ordering
application into a broader multi-service commerce platform.

---

## AI-Assisted Software Engineering

AI-assisted development tools, including **GitHub Copilot**, are used as part
of the software engineering workflow.

AI assistance is used for activities such as:

- Exploring implementation approaches
- Generating initial code structures
- Refactoring
- Debugging
- Test development
- Reviewing alternative designs
- Documentation
- Accelerating repetitive development tasks

AI-generated suggestions are reviewed and integrated as part of the normal
development process rather than being treated as automatically correct
production code.

The project therefore also serves as practical exploration of how AI-assisted
development can improve productivity across the software development lifecycle.

---

## Current Status

| Module | Status |
|---|---|
| Core platform | 🟢 Implemented |
| Authentication / JWT | 🟢 Implemented |
| Role-Based Access Control | 🟢 Implemented |
| Category management | 🟢 Implemented |
| Sub-category management | 🟢 Implemented |
| eSpectacles self-ordering | 🟢 Implemented / evolving |
| eGroceries pre-ordering | 🟢 Substantially implemented |
| eFreshes pre-ordering | 🟢 Substantially implemented |
| Additional eFancy services | 🔵 Planned / future expansion |

The project remains under active development. Features and architecture may
continue to evolve as additional use cases are implemented.

---

## Engineering Goals

Beyond implementing the application itself, eFancy2026 is intended to explore
several broader software-engineering goals:

- Building reusable full-stack application architectures
- Designing extensible service-domain models
- Developing maintainable REST APIs
- Implementing secure authentication and authorization
- Managing stateful ordering workflows
- Building responsive, mobile-first web applications
- Applying incremental refactoring
- Using AI effectively within professional software-development workflows

---

## Future Development

Potential future work includes:

- Additional eFancy service categories
- Enhanced order and pre-order workflows
- Payment integration
- Notification services
- Improved administration and reporting
- Database evolution for larger deployments
- Deployment automation
- Containerization
- Cloud deployment
- Automated testing and CI/CD
- Further mobile optimization

---

## Repository Topics

Suggested GitHub topics:

`react` `nodejs` `express` `sqlite` `javascript` `vite`
`full-stack` `rest-api` `ecommerce` `online-ordering`
`pre-ordering` `grocery` `order-management`
`jwt-authentication` `rbac`

---

## Author

**Daniel Zhou**

Principal Software Engineer with experience across enterprise software
development, full-stack engineering, system integration, application
modernization, cloud operations, and distributed systems.

Current technical interests include:

**Rust • C/C++ • React • TypeScript • Node.js • Java • Spring Boot •
Cloud • Distributed Systems • Software Modernization • AI-Assisted Development**

GitHub: `@Danny87Chew`

---

## Disclaimer

This project is a personal software-development project and is under active
development. It is intended for development, experimentation, learning, and
demonstration purposes.

It is not presented as a production-ready commercial service.

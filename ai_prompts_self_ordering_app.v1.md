# AI Prompts for Self-Ordering Spectacles & Multi-Service App

## 1. Product Requirements Prompt

You are a senior product manager. Convert the following business idea into a complete Product Requirements Document.

Build a cross-platform mobile and web application for self-ordering spectacles and related services. The app must run on iOS, Android, and WebUI with similar functionality across all platforms.

Core modules:
- eSpectacles: self-ordering spectacles
- eGroceries: grocery ordering
- eFreshes: fresh food pre-ordering
- eServices: service request and bidding marketplace

User roles:
- Normal/Consumer customer
- Vendor
- Admin
- Super Admin

Key requirements:
- Mobile number registration and login using OTP.
- Each registered user receives a unique user ID.
- User can set nickname and real name.
- Login should remain active until user manually logs out.
- Super Admin can manage admin users, permissions, prices, lens lists, and configurable defaults.
- Admin can manage listed spectacle frames, partner shops, products, vendors, and orders.

Generate:
1. User personas
2. Functional requirements
3. Non-functional requirements
4. User stories
5. Acceptance criteria
6. MVP scope
7. Future enhancement scope
8. Risks and assumptions


---

## 2. UX / UI Design Prompt

You are a senior UX/UI designer. Design a clean mobile-first interface for a multi-service ordering app.

Navigation requirements:
- Top row contains scalable tabs.
- First top tab is Home.
- Other top tabs are shortcuts to sub-home pages.
- Bottom row contains Cart, Orders, and Me.
- Main content area between top and bottom rows must be scrollable.
- Main Home page shows four large buttons, two per row:
  1. eSpectacles
  2. eGroceries
  3. eFreshes
  4. eServices
- Each button has a matching image and title underneath.
- Button positions can be customized by the user.

Create:
1. Mobile wireframe description
2. WebUI responsive layout
3. Navigation flow
4. Reusable design system
5. Component list
6. Accessibility recommendations
7. Empty/loading/error states


---

## 3. eSpectacles User Flow Prompt

You are a product designer and app architect. Create the full user journey for the eSpectacles module.

Pages:

### Page A: Choose Your Favorite Frame
Requirements:
- Display title: “Please choose your favorite frame”.
- Show a list/grid of spectacle frames with image and name.
- Frame list is managed by Admin and Super Admin
- Top “Next” button is disabled until a frame is selected.
- Selected frame is highlighted.
- Only one frame can be selected at a time.
- Clicking a frame opens a popup with enlarged image.
- Popup has close button at top-right.
- If a frame has multiple images, user can swipe left/right to view angles.
- On Next:
  - If no eyesight/lens data exists, go to Page B.
  - If user came from Ordering page with existing data, return to Ordering page with updated frame.

### Page B: Eyesight Data Choice
Requirements:
- Two radio buttons:
  - No Eyesight Data
  - Having Eyesight Data
- Default is No Eyesight Data.
- Top buttons: Modify, Confirm and Next.
- Next is disabled until Confirm is clicked.
- If No Eyesight Data:
  - Advise user to do eyesight checkup at a partner shop.
  - User pays fixed checkup fee, default $20.
  - Fee is configurable by Super Admin.
  - After payment, create pending order.
  - Pending order shows QR code for shop staff to scan.
  - Partner shop dropdown is searchable by postcode, road name, town, district or MRT station.
  - Partner details include shop name, address, opening time, and contact number.
  - Staff uploads eyesight data after checkup.
  - User refreshes pending order and continues to Ordering page.
- If Having Eyesight Data:
  - Show eyesight input fields.
	  - Left Eye: SPH, CYL, Axis, ADD
	  - Right Eye: SPH, CYL, Axis, ADD
	  - PD
  - User input the data accordingly and press Confirm button to make the Next button clickable
  - User press the Modify button to modify the data, which also grayed out the Next button
  - Next goes to Ordering page.

### Page C: Ordering Page
Top buttons:  Confirm.
Requirements:
- Show chosen spectacle frame and image.
- Frame can be changed by returning to Choose Frame page.
- Inputs:
  - Left Eye: SPH, CYL, Axis, ADD
  - Right Eye: SPH, CYL, Axis, ADD
  - PD
  - Thickness dropdown: 1.50, 1.56, 1.60, 1.67, 1.74
  - Suggested thickness is calculated from prescription values.
  - Blue-light Blocking: Yes/No
  - Photochromic Darkening: Yes/No
  - Progressive Lenses: Yes/No
  - Lens brand dropdown managed by Super Admin
- Total price updates immediately when lens options change.
- Confirm sends user to Confirmation page.

### Page E: Confirmation Page
Requirements:
- Show all order information as read-only.
- Top Modify button returns to Ordering page.
- Make Payment button opens Payment page.
- Display:
  - Frame image
  - Left/right eye data
  - PD
  - Thickness
  - Lens options
  - Chosen lens brand
  - Total price

### Page F: Payment Page
Payment methods:
- Credit/Debit Card
- PayLah!
- PayNow
- WeChat Pay
- AliPay

After payment:
- Order status becomes Paid.
- User is informed order can be modified/cancelled only within 12 hours.
- After 12 hours, order becomes Finalised.
- Finalised orders cannot be modified or cancelled.
- Cancelled orders are refunded within 4 weeks.

Generate:
1. Detailed page-by-page UX flow
2. State machine
3. Data model
4. Validation rules
5. Edge cases
6. API requirements
7. Test cases


---

## 4. Order Status State Machine Prompt

You are a backend architect. Design the order lifecycle state machine.

Order states:
- Opening
- Pending
- UserAccept
- VendorAccept
- Paid
- Finalised
- PendingService
- Completed
- Processing
- Ready for Shipping
- Delivered
- UserConfirmed
- SystemDone
- Cancelled

Rules:
- Pending order may be created after checkup payment.
- Paid order is created after product payment.
- Paid order can be modified or cancelled within 12 hours.
- After 12 hours, Paid becomes Finalised.
- Finalised cannot be modified or cancelled.
- Processing starts after finalisation.
- Ready for Shipping follows processing.
- Delivered closes the order.
- Cancelled order should trigger refund workflow where applicable.

Generate:
1. State transition table
2. Allowed actions per role
3. Timeout rules
4. Notification rules
5. Database fields
6. Backend pseudocode
7. API endpoints


---

## 5. Backend API Design Prompt

You are a senior backend engineer. Design REST or GraphQL APIs for this app.

Required domains:
- Authentication with mobile OTP
- User profile and roles
- Admin and Super Admin permissions
- Spectacle frame catalog
- Lens brand catalog
- Partner shop catalog
- Eyesight data records
- Orders
- Payments
- QR code checkup workflow
- Vendor order handling
- eGroceries
- eFreshes
- eServices bidding workflow

Generate:
1. API endpoint list
2. Request/response JSON examples
3. Authentication and authorization model
4. Role-based access control
5. Error codes
6. Database schema
7. Security considerations
8. Audit log requirements


---

## 6. Database Schema Prompt

You are a database architect. Design a normalized database schema for this app.

Entities:
- users
- roles
- permissions
- user_sessions
- otp_codes
- spectacle_frames
- frame_images
- lens_brands
- lens_options
- partner_shops
- eyesight_records
- orders
- order_items
- payments
- refunds
- QR checkup tokens
- grocery_products
- fresh_products
- service_requests
- service_bids
- notifications
- admin_audit_logs

Generate:
1. SQL tables
2. Primary keys and foreign keys
3. Indexes
4. Constraints
5. Example records
6. Migration order
7. Data retention recommendations


---

## 7. Frontend React / React Native Prompt

You are a senior frontend engineer. Build the frontend architecture for this cross-platform app.

Targets:
- iOS
- Android
- WebUI

Use a shared component architecture where possible.

Required screens:
- Login/Register with OTP
- Home
- eSpectacles sub-home
- Choose Frame
- Eyesight Data Choice
- Ordering
- Confirmation
- Payment
- Orders
- Cart
- Me / Settings
- Admin management screens
- Vendor order screens

Generate:
1. Folder structure
2. Component architecture
3. State management approach
4. Navigation structure
5. Form validation approach
6. API client structure
7. Example screen implementation
8. Unit test examples


---

## 8. Admin Portal Prompt

You are designing the Admin and Super Admin portal.

Admin capabilities:
- Manage spectacle frames
- Upload multiple frame images
- Manage partner shops
- View orders
- Update order statuses
- Manage product listings

Super Admin capabilities:
- All Admin permissions
- Create/delete admin users
- Modify admin permissions
- Configure eyesight checkup fee
- Manage available lens brands
- Set default values
- Configure pricing rules

Generate:
1. Admin dashboard structure
2. Permission matrix
3. CRUD workflows
4. Audit logging
5. Security rules
6. UI screens
7. Test cases


---

## 9. eFreshes Prompt

You are a product manager. Design the eFreshes module for pre-ordering fresh food, vegetables, seafood, chicken, duck, goose, and similar items.

Special attributes:
- All goods have Raw/Cleaned option.
- Default is Cleaned.
- Fish options:
  - Whole
  - Butterfly
  - Head-to-Tail Half
  - Flat Half
  - Flat Quarter
- Chicken, Duck, Goose options:
  - Whole
  - Flat Half
  - Flat Quarter
  - Small Pieces

Generate:
1. Product data model
2. Product ordering flow
3. Attribute selection UI
4. Pricing logic
5. Vendor management flow
6. Test cases


---

## 10. eServices Marketplace Prompt

You are a marketplace product architect. Design the eServices bidding workflow.

Service examples:
- Electrical work
- Plumbing
- Painting
- Carpentry
- Ceramic tiling
- Timber planking

Consumer creates service request with:
- Service description
- Desired service charge
- Desired service date
- Address road name
- Building name
- Block number
- No detailed unit number shown before acceptance

Provider workflow:
- Providers post bids with available date and service charge.
- Providers can see other providers’ service dates but not their charges.
- Consumer can accept a bid or counter-offer.
- Provider can accept counter-offer or submit another offer.
- Both sides receive notifications at each update.
- After consumer accepts bid, an order will be created with status of UserAccept, User can cancel the order
- provider confirms the order, the order status will become VendorAccpept, both User and Vendor can cancel the order(two buttons: User Cancel, Vendor Cancel)
- Consumer pays in the app. the order status will become Paid
- After payment, both User and Vendor can see the order, both can canel the order at 24 hours before
 The order provide the detailed address, contact number, and confirmed service charge, when comes to 24 hours before, the order status becomes PendingService
- After provider completed the service, set the order status to be Completed
- User then can sert the order to be "Confirmed". After 48 hours, if User did not set the order be "Confirmed", it will be set by system to be 'SystemDone"

Generate:
1. Complete bidding state machine
2. Data model
3. Privacy rules
4. Notification workflow
5. API endpoints
6. UI flow
7. Edge cases and abuse prevention


---

## 11. QA Test Plan Prompt

You are a QA lead. Create a complete test plan for the app.

Cover:
- OTP registration/login
- Role permissions
- Home navigation
- eSpectacles frame selection
- Eyesight data flow
- Partner shop search
- QR code workflow
- Ordering form validation
- Price calculation
- Confirmation page
- Payment methods
- Order status transitions
- Cancellation/refund rules
- Admin management
- Super Admin permissions
- eGroceries
- eFreshes product attributes
- eServices bidding and payment
- iOS, Android, and WebUI compatibility

Generate:
1. Test strategy
2. Functional test cases
3. Negative test cases
4. Security test cases
5. Performance test cases
6. Regression checklist
7. UAT checklist


---

## 12. Master Development Prompt

You are a senior full-stack engineering team. Build this application from requirements to implementation.

Deliver:
1. Product Requirements Document
2. UX flow
3. Database schema
4. Backend API design
5. Frontend architecture
6. Admin portal design
7. Payment integration design
8. Notification design
9. Security model
10. Test plan
11. MVP delivery roadmap

Important constraints:
- iOS, Android, and WebUI should have similar functionality.
- OTP-based mobile registration and login are required.
- Role-based access control is required.
- eSpectacles is the first priority module.
- eGroceries, eFreshes, and eServices can be phased after MVP.
- Super Admin must control configurable prices, lens lists, defaults, admins, and permissions.
- Order lifecycle and payment status must be reliable and auditable.

from sqlalchemy.orm import Session
from app.db.session import engine, Base
from app.models import Employee, Category, RestaurantTable, RestaurantSettings
from app.core.security import hash_password, hash_pin

def init_db(db: Session):
    """Create all tables and seed default operational data for Loaf n Leaf."""
    # Ensure all tables exist in database
    Base.metadata.create_all(bind=engine)

    # 1. Ensure Default Employees Exist
    admin_exists = db.query(Employee).filter(Employee.username == "admin").first()
    if not admin_exists:
        admin_emp = Employee(
            id="emp-admin-1",
            username="admin",
            email="admin@loafnleaf.com",
            full_name="Restaurant Admin",
            hashed_password=hash_password("admin123"),
            hashed_pin=hash_pin("1234"),
            role="admin",
            phone="+92 300 1234567",
            is_active=True
        )
        db.add(admin_emp)

    cashier_exists = db.query(Employee).filter(Employee.username == "cashier1").first()
    if not cashier_exists:
        cashier_emp = Employee(
            id="emp-cashier-1",
            username="cashier1",
            email="cashier@loafnleaf.com",
            full_name="Ahmed Khan (Cashier)",
            hashed_password=hash_password("cashier123"),
            hashed_pin=hash_pin("5678"),
            role="cashier",
            phone="+92 301 9876543",
            is_active=True
        )
        db.add(cashier_emp)

    waiter_exists = db.query(Employee).filter(Employee.username == "waiter1").first()
    if not waiter_exists:
        waiter_emp = Employee(
            id="emp-waiter-1",
            username="waiter1",
            email="waiter@loafnleaf.com",
            full_name="Hamza Tariq (Waiter)",
            hashed_password=hash_password("waiter123"),
            hashed_pin=hash_pin("7890"),
            role="order_taker",
            phone="+92 333 1122334",
            is_active=True
        )
        db.add(waiter_emp)

    # 2. Ensure Categories Exist
    if db.query(Category).count() == 0:
        categories_data = [
            ("cat-1", "All Items", "all", 0),
            ("cat-2", "Burgers", "burgers", 1),
            ("cat-3", "Pizza", "pizza", 2),
            ("cat-4", "BBQ & Grills", "bbq", 3),
            ("cat-5", "Drinks", "drinks", 4),
            ("cat-6", "Desserts", "desserts", 5),
        ]
        for cid, cname, cslug, corder in categories_data:
            db.add(Category(id=cid, name=cname, slug=cslug, sort_order=corder, is_active=True))

    # 3. Ensure Restaurant Tables Exist
    if db.query(RestaurantTable).count() == 0:
        tables_data = [
            ("tbl-1", "T-01", "Table 1", 2),
            ("tbl-2", "T-02", "Table 2", 2),
            ("tbl-3", "T-03", "Table 3", 4),
            ("tbl-4", "T-04", "Table 4", 4),
            ("tbl-5", "T-05", "Table 5", 4),
            ("tbl-6", "T-06", "Table 6", 6),
            ("tbl-7", "T-07", "Table 7", 6),
            ("tbl-8", "T-08", "Table 8", 8),
            ("tbl-9", "T-09", "Family Booth 1", 6),
            ("tbl-10", "T-10", "Family Booth 2", 6),
            ("tbl-11", "T-11", "Outdoor Terrace 1", 4),
            ("tbl-12", "T-12", "Outdoor Terrace 2", 4),
        ]
        for tid, tnum, tname, tcap in tables_data:
            db.add(RestaurantTable(id=tid, table_number=tnum, name=tname, capacity=tcap, status="available"))

    # 4. Ensure System Settings Exist
    settings_data = {
        "restaurant_name": "Loaf n Leaf",
        "restaurant_tagline": "Artisan Cafe & Charcoal Grill",
        "address": "Plot 12-C, 7th Zamzama Commercial Lane, Clifton, Karachi",
        "phone": "+92 21 3583 8920",
        "ntn_number": "7829104-5",
        "tax_name": "Sindh Sales Tax (SRB)",
        "tax_rate": "13.00",
        "tax_enabled": "true",
        "currency_symbol": "Rs.",
        "receipt_header": "LOAF N LEAF RESTAURANT\nTax Invoice",
        "receipt_footer": "Thank you for dining with Loaf n Leaf!\nArtisan Restaurant & Table Service",
        "max_devices_per_employee": "2",
        "active_shift": "Evening Shift (04:00 PM - 12:00 AM)"
    }
    for k, v in settings_data.items():
        existing = db.query(RestaurantSettings).filter(RestaurantSettings.key == k).first()
        if not existing:
            db.add(RestaurantSettings(key=k, value=v))

    db.commit()

import os
import sys
import uuid
import base64
import hashlib
from decimal import Decimal
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.db.session import SessionLocal
from app.db.init_db import init_db

def run_tests():
    print("=== STARTING FASTAPI BACKEND VERIFICATION TESTS ===\n")

    # 1. Initialize DB
    db = SessionLocal()
    init_db(db)
    client = TestClient(app)

    # 2. Test Health Endpoint
    print("Test 1: Testing /health endpoint...")
    res = client.get("/health")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    print("  -> Status:", res.json())

    # 3. Test Staff PIN Login
    print("\nTest 2: Testing Staff Quick PIN Login...")
    # Admin PIN
    admin_login = client.post("/api/v1/auth/login", json={"pin": "1234"})
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("  -> Admin Login OK! Token:", admin_token[:20] + "...")

    # Waiter PIN
    waiter_login = client.post("/api/v1/auth/login", json={"pin": "7890"})
    assert waiter_login.status_code == 200
    waiter_token = waiter_login.json()["access_token"]
    waiter_headers = {"Authorization": f"Bearer {waiter_token}"}
    print("  -> Waiter Login OK! Role:", waiter_login.json()["employee"]["role"])

    # Cashier PIN
    cashier_login = client.post("/api/v1/auth/login", json={"pin": "5678"})
    assert cashier_login.status_code == 200
    cashier_token = cashier_login.json()["access_token"]
    cashier_headers = {"Authorization": f"Bearer {cashier_token}"}
    print("  -> Cashier Login OK! Role:", cashier_login.json()["employee"]["role"])

    # 4. Test Cryptographic Keypair Generation & Challenge
    print("\nTest 3: Testing Device Cryptographic Verification...")
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    spki_der = public_key.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    spki_b64 = base64.b64encode(spki_der).decode()
    fingerprint = hashlib.sha256(spki_der).hexdigest()[:32]
    print("  -> Device Fingerprint:", fingerprint)

    chal_res = client.post("/api/v1/devices/challenge", json={"device_fingerprint": fingerprint})
    assert chal_res.status_code == 200
    chal_data = chal_res.json()
    challenge_id = chal_data["challenge_id"]
    nonce = chal_data["nonce"]
    print("  -> Received Nonce:", nonce[:16] + "...")

    # Sign challenge with ECDSA P-256
    raw_sig = private_key.sign(nonce.encode("utf-8"), ec.ECDSA(hashes.SHA256()))
    sig_b64 = base64.b64encode(raw_sig).decode()

    # 5. Device Registration Attempt (Expect 403 PENDING)
    print("\nTest 4: Registering new terminal with cryptographic signature...")
    dev_login = client.post("/api/v1/devices/verify-and-login", json={
        "identifier": "cashier1",
        "password": "cashier123",
        "device_fingerprint": fingerprint,
        "public_key_spki": spki_b64,
        "challenge_id": challenge_id,
        "signature": sig_b64,
        "device_name": "Counter Station 1",
        "requested_role": "cashier"
    })
    assert dev_login.status_code == 403, f"Expected 403, got {dev_login.status_code}"
    dev_err = dev_login.json()["detail"]
    assert dev_err["status"] == "pending"
    device_id = dev_err["deviceId"]
    print("  -> PASS: New device blocked with status PENDING. ID:", device_id)

    # 6. Admin Approves Terminal for Role [cashier]
    print("\nTest 5: Admin approving device for role [cashier]...")
    # Clean up prior test runs' devices for this cashier to respect max device limit
    existing_devs = client.get("/api/v1/devices/admin/devices", headers=admin_headers).json()
    cashier_emp_id = cashier_login.json()["employee"]["id"]
    for d in existing_devs:
        if d.get("assigned_employee_id") == cashier_emp_id and d.get("status") == "approved":
            client.post(f"/api/v1/devices/admin/devices/{d['id']}/revoke", json={"reason": "Test setup reset"}, headers=admin_headers)

    approve_res = client.post(
        f"/api/v1/devices/admin/devices/{device_id}/approve",
        json={"assigned_employee_id": cashier_emp_id, "permitted_roles": ["cashier"]},
        headers=admin_headers
    )
    assert approve_res.status_code == 200, f"Approve failed: {approve_res.text}"
    print("  -> PASS:", approve_res.json()["message"])

    # 7. Cashier Login on Approved Terminal
    print("\nTest 6: Cashier logging in on approved terminal...")
    chal2 = client.post("/api/v1/devices/challenge", json={"device_fingerprint": fingerprint}).json()
    sig2 = base64.b64encode(private_key.sign(chal2["nonce"].encode("utf-8"), ec.ECDSA(hashes.SHA256()))).decode()
    login_approved = client.post("/api/v1/devices/verify-and-login", json={
        "pin": "5678",
        "device_fingerprint": fingerprint,
        "public_key_spki": spki_b64,
        "challenge_id": chal2["challenge_id"],
        "signature": sig2,
        "device_name": "Counter Station 1",
        "requested_role": "cashier"
    })
    assert login_approved.status_code == 200, f"Login failed: {login_approved.text}"
    session_token = login_approved.json()["sessionToken"]
    print("  -> PASS: Session established! Token:", session_token[:16] + "...")

    # 8. Test Role Mismatch Restriction (Admin attempting to use Cashier-only terminal)
    print("\nTest 7: Testing role restriction (Admin trying to log in on Cashier-only terminal)...")
    chal3 = client.post("/api/v1/devices/challenge", json={"device_fingerprint": fingerprint}).json()
    sig3 = base64.b64encode(private_key.sign(chal3["nonce"].encode("utf-8"), ec.ECDSA(hashes.SHA256()))).decode()
    mismatch_login = client.post("/api/v1/devices/verify-and-login", json={
        "pin": "1234",
        "device_fingerprint": fingerprint,
        "public_key_spki": spki_b64,
        "challenge_id": chal3["challenge_id"],
        "signature": sig3,
        "requested_role": "admin"
    })
    assert mismatch_login.status_code == 403
    assert mismatch_login.json()["detail"]["code"] == "DEVICE_ROLE_MISMATCH"
    print("  -> PASS: Terminal strictly blocked admin attempt due to role mismatch!")

    # 9. Test Product Creation
    print("\nTest 8: Admin creating menu products...")
    cats = client.get("/api/v1/categories").json()
    burger_cat = next(c for c in cats if c["slug"] == "burgers")

    unique_suffix = uuid.uuid4().hex[:6]
    b_code = f"B-{unique_suffix}"
    d_code = f"D-{unique_suffix}"

    new_prod = client.post("/api/v1/products", json={
        "name": f"Artisan Smash Burger {unique_suffix}",
        "category_id": burger_cat["id"],
        "price": 950.00,
        "cost": 450.00,
        "code": b_code,
        "description": "Double Angus beef with aged cheddar and brioche bun"
    }, headers=admin_headers)
    assert new_prod.status_code == 201, f"Product create failed: {new_prod.text}"
    prod_id = new_prod.json()["id"]
    print(f"  -> Created product: {new_prod.json()['name']} @ Rs. {new_prod.json()['price']}")

    drink_cat = next(c for c in cats if c["slug"] == "drinks")
    drink_prod = client.post("/api/v1/products", json={
        "name": f"Mint Lemonade Spritzer {unique_suffix}",
        "category_id": drink_cat["id"],
        "price": 320.00,
        "cost": 80.00,
        "code": d_code
    }, headers=admin_headers).json()
    print(f"  -> Created product: {drink_prod['name']} @ Rs. {drink_prod['price']}")

    # 10. Test Waiter Creating Dine-In Order for Available Table
    tbl_list = client.get("/api/v1/tables").json()
    avail_tbl = next((t for t in tbl_list if t["status"] == "available"), tbl_list[0])
    tbl_target = avail_tbl["table_number"]

    print(f"\nTest 9: Waiter creating Dine-In order for Table {tbl_target}...")
    order_res = client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "table_id": tbl_target,
        "items": [
            {"product_id": prod_id, "quantity": 2, "special_instructions": "No pickles"},
            {"product_id": drink_prod["id"], "quantity": 2}
        ]
    }, headers=waiter_headers)
    assert order_res.status_code == 201, f"Order create failed: {order_res.text}"
    order = order_res.json()
    order_id = order["id"]
    print(f"  -> Order #{order['order_number']} created! Subtotal: Rs. {order['subtotal']}, Tax (13%): Rs. {order['tax_amount']}, Grand Total: Rs. {order['grand_total']}")

    # Verify target table is occupied
    tbl_check = client.get("/api/v1/tables").json()
    t_target = next(t for t in tbl_check if t["table_number"] == tbl_target)
    assert t_target["status"] == "occupied" and t_target["active_order_id"] == order_id
    print(f"  -> PASS: Table {tbl_target} locked as OCCUPIED with active bill.")

    # 11. Test Appending Additional Items to Target Table
    print(f"\nTest 10: Waiter appending 1 additional drink to Table {tbl_target}...")
    append_res = client.post(f"/api/v1/orders/{order_id}/append", json={
        "items": [{"product_id": drink_prod["id"], "quantity": 1, "special_instructions": "Extra ice"}]
    }, headers=waiter_headers)
    assert append_res.status_code == 200
    updated_order = append_res.json()
    print(f"  -> Updated Grand Total after append: Rs. {updated_order['grand_total']} (Items count: {len(updated_order['items'])})")

    # 12. Test Cashier Processing Cash Payment & Exact Change
    print("\nTest 11: Cashier processing cash checkout with change calculation...")
    due_amount = Decimal(str(updated_order["grand_total"]))
    received = due_amount + Decimal("1000.00")  # Paying with extra Rs. 1000

    checkout_res = client.post("/api/v1/payments/checkout", json={
        "order_id": order_id,
        "payment_method": "cash",
        "received_amount": float(received),
        "idempotency_key": f"test-idemp-{order['order_number']}"
    }, headers=cashier_headers)
    assert checkout_res.status_code == 201, f"Checkout failed: {checkout_res.text}"
    payment = checkout_res.json()
    print(f"  -> Payment settled! Paid: Rs. {payment['amount_paid']}, Received: Rs. {payment['received_amount']}, Change Given: Rs. {payment['change_given']}")
    assert Decimal(str(payment["change_given"])) == Decimal("1000.00")

    # Verify target table is now freed and available
    tbl_after = client.get("/api/v1/tables").json()
    t_target_after = next(t for t in tbl_after if t["table_number"] == tbl_target)
    assert t_target_after["status"] == "available" and t_target_after["active_order_id"] is None
    print(f"  -> PASS: Table {tbl_target} freed and released back to available state!")

    # 13. Test Thermal Receipt Generation
    print("\nTest 12: Generating 80mm thermal receipt payload...")
    receipt_res = client.get(f"/api/v1/payments/receipt/{order_id}")
    assert receipt_res.status_code == 200
    rcpt = receipt_res.json()
    print(f"  -> Receipt generated for {rcpt['restaurant']['name']}:")
    print(f"     Order #{rcpt['order']['order_number']} | Cashier: {rcpt['order']['cashier']}")
    print(f"     Subtotal: Rs. {rcpt['summary']['subtotal']} | Total: Rs. {rcpt['summary']['grand_total']}")
    print(f"     Payment: {rcpt['summary']['payment_method']} | Change: Rs. {rcpt['summary']['change_given']}")

    # 14. Test Sales Reports Summary
    print("\nTest 13: Admin viewing sales report summary...")
    report_res = client.get("/api/v1/reports/summary?period=today", headers=admin_headers)
    assert report_res.status_code == 200
    rep = report_res.json()
    print(f"  -> Today's Total Sales: Rs. {rep['metrics']['total_sales']} across {rep['metrics']['total_orders']} orders")
    print(f"  -> Cash Sales: Rs. {rep['metrics']['cash_sales']} | Tax Collected: Rs. {rep['metrics']['total_tax']}")

    # 15. Test Device Revocation
    print("\nTest 14: Admin revoking device access...")
    revoke_res = client.post(
        f"/api/v1/devices/admin/devices/{device_id}/revoke",
        json={"reason": "Testing emergency device revocation"},
        headers=admin_headers
    )
    assert revoke_res.status_code == 200
    print("  -> PASS: Device revoked by administrator.")

    # Subsequent login blocked
    chal4 = client.post("/api/v1/devices/challenge", json={"device_fingerprint": fingerprint}).json()
    sig4 = base64.b64encode(private_key.sign(chal4["nonce"].encode("utf-8"), ec.ECDSA(hashes.SHA256()))).decode()
    blocked_res = client.post("/api/v1/devices/verify-and-login", json={
        "pin": "5678",
        "device_fingerprint": fingerprint,
        "public_key_spki": spki_b64,
        "challenge_id": chal4["challenge_id"],
        "signature": sig4
    })
    assert blocked_res.status_code == 403
    assert blocked_res.json()["detail"]["code"] == "DEVICE_REVOKED"
    print("  -> PASS: Revoked device immediately blocked on retry!")

    print("\n=== ALL 14 FASTAPI BACKEND VERIFICATION TESTS PASSED! ===")

if __name__ == "__main__":
    run_tests()

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import secrets
import bcrypt
import jwt
import httpx
import json
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from typing import List, Optional, Dict

# ===== ENVIRONMENT & DATABASE =====
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@freshmart.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin@123')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===== PYDANTIC MODELS =====
class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPassword(BaseModel):
    email: str

class ResetPassword(BaseModel):
    token: str
    new_password: str

class GoogleSession(BaseModel):
    session_id: str

class RefreshRequest(BaseModel):
    refresh_token: str

class CategoryCreate(BaseModel):
    name: str
    image: str = ""
    description: str = ""
    order: int = 0

class ProductCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    discount: float = 0
    category_id: str
    category_name: str = ""
    images: List[str] = []
    stock: int = 100
    unit: str = "piece"
    featured: bool = False

class CartItemReq(BaseModel):
    product_id: str
    quantity: int = 1

class AddressCreate(BaseModel):
    name: str
    phone: str
    line1: str
    line2: str = ""
    city: str
    state: str
    pincode: str
    is_default: bool = False

class OrderCreate(BaseModel):
    address_id: str
    payment_method: str = "cod"
    coupon_code: str = ""

class CheckoutRequest(BaseModel):
    order_id: str
    origin_url: str

class AISearchRequest(BaseModel):
    query: str

class WishlistItem(BaseModel):
    product_id: str

class StatusUpdate(BaseModel):
    status: str

class CouponValidate(BaseModel):
    code: str
    subtotal: float = 0

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

class PushTokenRegister(BaseModel):
    push_token: str

class SendNotification(BaseModel):
    user_id: str
    title: str
    body: str

class ImageUpload(BaseModel):
    image_data: str  # base64 encoded image
    filename: str = ""

# ===== AUTH HELPERS =====
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def check_brute_force(identifier: str):
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("locked_until"):
        locked_until = attempt["locked_until"]
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until)
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})

async def record_failed_attempt(identifier: str):
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt:
        new_count = attempt.get("attempts", 0) + 1
        update_data = {"attempts": new_count}
        if new_count >= 5:
            update_data["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=15)
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update_data})
    else:
        await db.login_attempts.insert_one({"identifier": identifier, "attempts": 1, "locked_until": None})

# ===== APP SETUP =====
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ===== AUTH ROUTES =====
@api_router.post("/auth/register")
async def register(data: UserRegister):
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "customer",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    user_response = {k: v for k, v in user_doc.items() if k not in ("password_hash", "_id")}
    return {"user": user_response, "access_token": access_token, "refresh_token": refresh_token}

@api_router.post("/auth/login")
async def login(data: UserLogin, request: Request):
    email = data.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    await check_brute_force(identifier)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(data.password, user["password_hash"]):
        await record_failed_attempt(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    access_token = create_access_token(user["user_id"], email)
    refresh_token = create_refresh_token(user["user_id"])
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    return {"user": user_response, "access_token": access_token, "refresh_token": refresh_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {"user": user}

@api_router.post("/auth/logout")
async def logout():
    return {"message": "Logged out successfully"}

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPassword):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        return {"message": "If account exists, reset link sent"}
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": user["user_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1), "used": False
    })
    logger.info(f"Password reset token for {email}: {token}")
    return {"message": "If account exists, reset link sent", "reset_token": token}

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPassword):
    token_doc = await db.password_reset_tokens.find_one({"token": data.token, "used": False}, {"_id": 0})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    expires_at = token_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    await db.users.update_one({"user_id": token_doc["user_id"]}, {"$set": {"password_hash": hash_password(data.new_password)}})
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True}})
    return {"message": "Password reset successfully"}

@api_router.post("/auth/google-session")
async def google_session(data: GoogleSession):
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": data.session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        session_data = resp.json()
    email = session_data["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": session_data.get("name", existing.get("name", "")), "picture": session_data.get("picture", "")}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email,
            "name": session_data.get("name", ""), "picture": session_data.get("picture", ""),
            "role": "customer", "created_at": datetime.now(timezone.utc).isoformat()
        })
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"user": user, "access_token": access_token, "refresh_token": refresh_token}

@api_router.post("/auth/refresh")
async def refresh_token_endpoint(data: RefreshRequest):
    token = data.refresh_token
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token(user["user_id"], user["email"])
        return {"access_token": new_access}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ===== CATEGORY ROUTES =====
@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return {"categories": cats}

@api_router.get("/categories/{category_id}")
async def get_category(category_id: str):
    cat = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat

# ===== PRODUCT ROUTES =====
@api_router.get("/products")
async def get_products(
    category: str = None, featured: bool = None, limit: int = 50, skip: int = 0,
    sort: str = None, min_price: float = None, max_price: float = None, search: str = None
):
    query = {}
    if category:
        query["category_id"] = category
    if featured is not None:
        query["featured"] = featured
    if min_price is not None or max_price is not None:
        price_filter = {}
        if min_price is not None:
            price_filter["$gte"] = min_price
        if max_price is not None:
            price_filter["$lte"] = max_price
        query["price"] = price_filter
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"category_name": {"$regex": search, "$options": "i"}}
        ]
    sort_field = [("created_at", -1)]
    if sort == "price_low":
        sort_field = [("price", 1)]
    elif sort == "price_high":
        sort_field = [("price", -1)]
    elif sort == "name":
        sort_field = [("name", 1)]
    products = await db.products.find(query, {"_id": 0}).sort(sort_field).skip(skip).limit(limit).to_list(limit)
    total = await db.products.count_documents(query)
    return {"products": products, "total": total}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# ===== CART ROUTES =====
@api_router.get("/cart")
async def get_cart(request: Request):
    user = await get_current_user(request)
    cart = await db.carts.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not cart:
        return {"user_id": user["user_id"], "items": [], "total": 0}
    enriched_items = []
    total = 0
    for item in cart.get("items", []):
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if product:
            effective_price = product["price"] * (1 - product.get("discount", 0) / 100)
            enriched_item = {**item, "product": product, "subtotal": round(effective_price * item["quantity"], 2)}
            enriched_items.append(enriched_item)
            total += enriched_item["subtotal"]
    return {"user_id": user["user_id"], "items": enriched_items, "total": round(total, 2)}

@api_router.post("/cart/add")
async def add_to_cart(item: CartItemReq, request: Request):
    user = await get_current_user(request)
    product = await db.products.find_one({"product_id": item.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.get("stock", 0) < item.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    cart = await db.carts.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if cart:
        existing = next((i for i in cart["items"] if i["product_id"] == item.product_id), None)
        if existing:
            existing["quantity"] += item.quantity
            await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": cart["items"], "updated_at": datetime.now(timezone.utc).isoformat()}})
        else:
            await db.carts.update_one({"user_id": user["user_id"]}, {"$push": {"items": {"product_id": item.product_id, "quantity": item.quantity}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        await db.carts.insert_one({"user_id": user["user_id"], "items": [{"product_id": item.product_id, "quantity": item.quantity}], "updated_at": datetime.now(timezone.utc).isoformat()})
    return {"message": "Added to cart"}

@api_router.put("/cart/update")
async def update_cart_item(item: CartItemReq, request: Request):
    user = await get_current_user(request)
    if item.quantity <= 0:
        await db.carts.update_one({"user_id": user["user_id"]}, {"$pull": {"items": {"product_id": item.product_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        await db.carts.update_one({"user_id": user["user_id"], "items.product_id": item.product_id}, {"$set": {"items.$.quantity": item.quantity, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Cart updated"}

@api_router.delete("/cart/remove/{product_id}")
async def remove_from_cart(product_id: str, request: Request):
    user = await get_current_user(request)
    await db.carts.update_one({"user_id": user["user_id"]}, {"$pull": {"items": {"product_id": product_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Item removed from cart"}

@api_router.delete("/cart/clear")
async def clear_cart(request: Request):
    user = await get_current_user(request)
    await db.carts.delete_one({"user_id": user["user_id"]})
    return {"message": "Cart cleared"}

# ===== ADDRESS ROUTES =====
@api_router.get("/addresses")
async def get_addresses(request: Request):
    user = await get_current_user(request)
    addresses = await db.addresses.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(20)
    return {"addresses": addresses}

@api_router.post("/addresses")
async def create_address(data: AddressCreate, request: Request):
    user = await get_current_user(request)
    address_id = f"addr_{uuid.uuid4().hex[:12]}"
    if data.is_default:
        await db.addresses.update_many({"user_id": user["user_id"]}, {"$set": {"is_default": False}})
    address_doc = {"address_id": address_id, "user_id": user["user_id"], **data.dict(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.addresses.insert_one(address_doc)
    address_doc.pop("_id", None)
    return address_doc

@api_router.put("/addresses/{address_id}")
async def update_address(address_id: str, data: AddressCreate, request: Request):
    user = await get_current_user(request)
    if data.is_default:
        await db.addresses.update_many({"user_id": user["user_id"]}, {"$set": {"is_default": False}})
    result = await db.addresses.update_one({"address_id": address_id, "user_id": user["user_id"]}, {"$set": data.dict()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"message": "Address updated"}

@api_router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.addresses.delete_one({"address_id": address_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"message": "Address deleted"}

# ===== ORDER ROUTES =====
@api_router.post("/orders")
async def create_order(data: OrderCreate, request: Request):
    user = await get_current_user(request)
    cart = await db.carts.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    address = await db.addresses.find_one({"address_id": data.address_id, "user_id": user["user_id"]}, {"_id": 0})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    order_items = []
    subtotal = 0
    for item in cart["items"]:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if not product:
            continue
        effective_price = product["price"] * (1 - product.get("discount", 0) / 100)
        order_item = {
            "product_id": item["product_id"], "name": product["name"],
            "price": product["price"], "discount": product.get("discount", 0),
            "effective_price": round(effective_price, 2), "quantity": item["quantity"],
            "subtotal": round(effective_price * item["quantity"], 2),
            "unit": product.get("unit", "piece"),
            "image": product["images"][0] if product.get("images") else ""
        }
        order_items.append(order_item)
        subtotal += order_item["subtotal"]
    discount_amount = 0
    if data.coupon_code:
        coupon = await db.coupons.find_one({"code": data.coupon_code.upper(), "active": True}, {"_id": 0})
        if coupon:
            discount_amount = subtotal * coupon["discount_percent"] / 100
            if coupon.get("max_discount") and discount_amount > coupon["max_discount"]:
                discount_amount = coupon["max_discount"]
            if subtotal < coupon.get("min_order", 0):
                discount_amount = 0
    total = round(subtotal - discount_amount, 2)
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    addr_clean = {k: v for k, v in address.items() if k != "user_id"}
    order_doc = {
        "order_id": order_id, "user_id": user["user_id"], "items": order_items,
        "subtotal": round(subtotal, 2), "discount": round(discount_amount, 2), "total": total,
        "address": addr_clean, "payment_method": data.payment_method,
        "payment_status": "pending" if data.payment_method == "stripe" else "cod",
        "status": "pending" if data.payment_method == "stripe" else "confirmed",
        "coupon_code": data.coupon_code if discount_amount > 0 else "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order_doc)
    for item in cart["items"]:
        await db.products.update_one({"product_id": item["product_id"]}, {"$inc": {"stock": -item["quantity"]}})
    await db.carts.delete_one({"user_id": user["user_id"]})
    order_doc.pop("_id", None)
    # Send push notification for new order
    await create_notification(
        user["user_id"],
        "Order Placed!",
        f"Your order #{order_id[-8:]} for ${total:.2f} has been placed successfully.",
        "order",
        {"order_id": order_id}
    )
    return order_doc

@api_router.get("/orders")
async def get_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"orders": orders}

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, request: Request):
    user = await get_current_user(request)
    order = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# ===== PAYMENT ROUTES =====
@api_router.post("/checkout/create-session")
async def create_checkout_session(data: CheckoutRequest, request: Request):
    user = await get_current_user(request)
    order = await db.orders.find_one({"order_id": data.order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    host_url = data.origin_url.rstrip("/")
    success_url = f"{host_url}/checkout-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/checkout"
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    checkout_request = CheckoutSessionRequest(
        amount=float(order["total"]), currency="usd",
        success_url=success_url, cancel_url=cancel_url,
        metadata={"order_id": data.order_id, "user_id": user["user_id"]}
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id, "order_id": data.order_id,
        "user_id": user["user_id"], "amount": float(order["total"]),
        "currency": "usd", "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    user = await get_current_user(request)
    transaction = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"status": status.status, "payment_status": status.payment_status}})
    if status.payment_status == "paid" and transaction.get("payment_status") != "paid":
        await db.orders.update_one({"order_id": transaction["order_id"]}, {"$set": {"payment_status": "paid", "status": "confirmed"}})
    return {"status": status.status, "payment_status": status.payment_status, "amount_total": status.amount_total}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, signature)
        if event.payment_status == "paid":
            transaction = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
            if transaction and transaction.get("payment_status") != "paid":
                await db.payment_transactions.update_one({"session_id": event.session_id}, {"$set": {"status": "complete", "payment_status": "paid"}})
                await db.orders.update_one({"order_id": transaction["order_id"]}, {"$set": {"payment_status": "paid", "status": "confirmed"}})
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ===== AI ROUTES =====
@api_router.post("/ai/search")
async def ai_search(data: AISearchRequest):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        products = await db.products.find({}, {"_id": 0, "product_id": 1, "name": 1, "category_name": 1, "price": 1, "unit": 1}).to_list(200)
        product_list = "\n".join([f"- {p['name']} ({p.get('category_name', '')}) - ${p['price']}/{p.get('unit', 'piece')}" for p in products])
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"search_{uuid.uuid4().hex[:8]}",
            system_message=f"You are a grocery search assistant. Given a user query, return a JSON array of matching product names from:\n{product_list}\nReturn ONLY a JSON array like: [\"Product Name 1\"]. If query is about a recipe/meal, suggest ingredients. Empty array if no matches."
        ).with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=data.query))
        try:
            matched_names = json.loads(response)
        except Exception:
            match = re.search(r'\[.*?\]', response, re.DOTALL)
            matched_names = json.loads(match.group()) if match else []
        if matched_names:
            matched_products = await db.products.find({"name": {"$in": matched_names}}, {"_id": 0}).to_list(50)
        else:
            matched_products = await db.products.find({"$or": [{"name": {"$regex": data.query, "$options": "i"}}, {"description": {"$regex": data.query, "$options": "i"}}]}, {"_id": 0}).to_list(50)
        return {"products": matched_products, "ai_response": response}
    except Exception as e:
        logger.error(f"AI search error: {e}")
        products = await db.products.find({"$or": [{"name": {"$regex": data.query, "$options": "i"}}, {"description": {"$regex": data.query, "$options": "i"}}]}, {"_id": 0}).to_list(50)
        return {"products": products, "ai_response": ""}

# ===== WISHLIST ROUTES =====
@api_router.get("/wishlist")
async def get_wishlist(request: Request):
    user = await get_current_user(request)
    wishlist = await db.wishlists.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not wishlist:
        return {"items": []}
    products = []
    for pid in wishlist.get("product_ids", []):
        product = await db.products.find_one({"product_id": pid}, {"_id": 0})
        if product:
            products.append(product)
    return {"items": products}

@api_router.post("/wishlist/toggle")
async def toggle_wishlist(data: WishlistItem, request: Request):
    user = await get_current_user(request)
    wishlist = await db.wishlists.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not wishlist:
        await db.wishlists.insert_one({"user_id": user["user_id"], "product_ids": [data.product_id]})
        return {"added": True}
    if data.product_id in wishlist.get("product_ids", []):
        await db.wishlists.update_one({"user_id": user["user_id"]}, {"$pull": {"product_ids": data.product_id}})
        return {"added": False}
    else:
        await db.wishlists.update_one({"user_id": user["user_id"]}, {"$push": {"product_ids": data.product_id}})
        return {"added": True}

# ===== COUPON ROUTES =====
@api_router.post("/coupons/validate")
async def validate_coupon(data: CouponValidate, request: Request):
    await get_current_user(request)
    code = data.code.upper()
    coupon = await db.coupons.find_one({"code": code, "active": True}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    if data.subtotal < coupon.get("min_order", 0):
        raise HTTPException(status_code=400, detail=f"Minimum order amount: ${coupon['min_order']}")
    discount = data.subtotal * coupon["discount_percent"] / 100
    if coupon.get("max_discount") and discount > coupon["max_discount"]:
        discount = coupon["max_discount"]
    return {"valid": True, "discount": round(discount, 2), "coupon": coupon}

# ===== ADMIN ROUTES =====
@api_router.post("/admin/categories")
async def admin_create_category(data: CategoryCreate, request: Request):
    await get_admin_user(request)
    category_id = f"cat_{uuid.uuid4().hex[:12]}"
    cat_doc = {"category_id": category_id, **data.dict()}
    await db.categories.insert_one(cat_doc)
    cat_doc.pop("_id", None)
    return cat_doc

@api_router.put("/admin/categories/{category_id}")
async def admin_update_category(category_id: str, data: CategoryCreate, request: Request):
    await get_admin_user(request)
    result = await db.categories.update_one({"category_id": category_id}, {"$set": data.dict()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category updated"}

@api_router.delete("/admin/categories/{category_id}")
async def admin_delete_category(category_id: str, request: Request):
    await get_admin_user(request)
    result = await db.categories.delete_one({"category_id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

@api_router.post("/admin/products")
async def admin_create_product(data: ProductCreate, request: Request):
    await get_admin_user(request)
    product_id = f"prod_{uuid.uuid4().hex[:12]}"
    if data.category_id:
        cat = await db.categories.find_one({"category_id": data.category_id}, {"_id": 0})
        if cat:
            data.category_name = cat["name"]
    prod_doc = {"product_id": product_id, **data.dict(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.products.insert_one(prod_doc)
    prod_doc.pop("_id", None)
    return prod_doc

@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, data: ProductCreate, request: Request):
    await get_admin_user(request)
    result = await db.products.update_one({"product_id": product_id}, {"$set": data.dict()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product updated"}

@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, request: Request):
    await get_admin_user(request)
    result = await db.products.delete_one({"product_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@api_router.get("/admin/orders")
async def admin_get_orders(request: Request, status: str = None):
    await get_admin_user(request)
    query = {}
    if status:
        query["status"] = status
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"orders": orders}

@api_router.put("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, data: StatusUpdate, request: Request):
    await get_admin_user(request)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    result = await db.orders.update_one({"order_id": order_id}, {"$set": {"status": data.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    # Send notification on status change
    status_messages = {
        "confirmed": f"Your order #{order_id[-8:]} has been confirmed!",
        "delivered": f"Your order #{order_id[-8:]} has been delivered. Enjoy!",
        "cancelled": f"Your order #{order_id[-8:]} has been cancelled.",
    }
    msg = status_messages.get(data.status, f"Your order #{order_id[-8:]} status: {data.status}")
    await create_notification(order["user_id"], f"Order {data.status.title()}", msg, "order", {"order_id": order_id})
    return {"message": "Order status updated"}

@api_router.get("/admin/dashboard")
async def admin_dashboard(request: Request):
    await get_admin_user(request)
    total_orders = await db.orders.count_documents({})
    total_products = await db.products.count_documents({})
    total_users = await db.users.count_documents({})
    pipeline = [{"$match": {"payment_status": {"$in": ["paid", "cod"]}}}, {"$group": {"_id": None, "total": {"$sum": "$total"}}}]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    pending_orders = await db.orders.count_documents({"status": "pending"})
    return {
        "total_orders": total_orders, "total_products": total_products,
        "total_users": total_users, "total_revenue": round(total_revenue, 2),
        "pending_orders": pending_orders
    }

@api_router.post("/admin/coupons")
async def admin_create_coupon(request: Request):
    await get_admin_user(request)
    body = await request.json()
    coupon_doc = {
        "coupon_id": f"coupon_{uuid.uuid4().hex[:8]}", "code": body.get("code", "").upper(),
        "discount_percent": body.get("discount_percent", 10), "min_order": body.get("min_order", 0),
        "max_discount": body.get("max_discount", 0), "active": body.get("active", True)
    }
    await db.coupons.insert_one(coupon_doc)
    coupon_doc.pop("_id", None)
    return coupon_doc

# ===== PUSH NOTIFICATION ROUTES =====
@api_router.post("/notifications/register-token")
async def register_push_token(data: PushTokenRegister, request: Request):
    user = await get_current_user(request)
    await db.push_tokens.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"user_id": user["user_id"], "push_token": data.push_token, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Push token registered"}

@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    notifs = await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"notifications": notifs}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    user = await get_current_user(request)
    await db.notifications.update_many({"user_id": user["user_id"], "read": False}, {"$set": {"read": True}})
    return {"message": "All notifications marked as read"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(request: Request):
    user = await get_current_user(request)
    count = await db.notifications.count_documents({"user_id": user["user_id"], "read": False})
    return {"count": count}

async def create_notification(user_id: str, title: str, body: str, notif_type: str = "general", data: dict = None):
    """Create an in-app notification and attempt push"""
    notif_doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "title": title,
        "body": body,
        "type": notif_type,
        "data": data or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif_doc)
    # Try sending push notification via Expo Push API
    token_doc = await db.push_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if token_doc and token_doc.get("push_token"):
        try:
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json={
                        "to": token_doc["push_token"],
                        "title": title,
                        "body": body,
                        "data": data or {},
                        "sound": "default",
                    },
                    headers={"Content-Type": "application/json"}
                )
        except Exception as e:
            logger.warning(f"Push notification failed for {user_id}: {e}")
    return notif_doc

# Admin: Send notification to a user
@api_router.post("/admin/notifications/send")
async def admin_send_notification(data: SendNotification, request: Request):
    await get_admin_user(request)
    notif = await create_notification(data.user_id, data.title, data.body, "admin")
    notif.pop("_id", None)
    return notif

# Admin: Broadcast notification to all users
@api_router.post("/admin/notifications/broadcast")
async def admin_broadcast_notification(request: Request):
    admin = await get_admin_user(request)
    body = await request.json()
    title = body.get("title", "")
    msg = body.get("body", "")
    if not title or not msg:
        raise HTTPException(status_code=400, detail="Title and body required")
    users = await db.users.find({}, {"_id": 0, "user_id": 1}).to_list(1000)
    count = 0
    for u in users:
        await create_notification(u["user_id"], title, msg, "promo")
        count += 1
    return {"message": f"Sent to {count} users"}

# ===== IMAGE UPLOAD ROUTES =====
@api_router.post("/upload/image")
async def upload_image(data: ImageUpload, request: Request):
    await get_admin_user(request)
    image_id = f"img_{uuid.uuid4().hex[:12]}"
    img_doc = {
        "image_id": image_id,
        "image_data": data.image_data,
        "filename": data.filename or f"{image_id}.jpg",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.images.insert_one(img_doc)
    return {"image_id": image_id, "url": f"/api/images/{image_id}"}

@api_router.get("/images/{image_id}")
async def get_image(image_id: str):
    from fastapi.responses import Response
    import base64
    img = await db.images.find_one({"image_id": image_id}, {"_id": 0})
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    try:
        raw = img["image_data"]
        if "," in raw:
            raw = raw.split(",", 1)[1]
        img_bytes = base64.b64decode(raw)
        content_type = "image/jpeg"
        if img.get("filename", "").endswith(".png"):
            content_type = "image/png"
        return Response(content=img_bytes, media_type=content_type)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decode image")

# ===== PROFILE ROUTES =====
@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.phone is not None:
        update_data["phone"] = data.phone
    if update_data:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"user": updated_user}

# ===== INCLUDE ROUTER =====
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== SEED DATA =====
SEED_CATEGORIES = [
    {"category_id": "cat_rice", "name": "Rice & Grains", "image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400", "description": "Premium quality rice and grains", "order": 1},
    {"category_id": "cat_flour", "name": "Flour & Atta", "image": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400", "description": "Fresh flour and atta", "order": 2},
    {"category_id": "cat_oil", "name": "Cooking Oil", "image": "https://images.unsplash.com/photo-1474979266404-7eaacdc948b6?w=400", "description": "Pure cooking oils", "order": 3},
    {"category_id": "cat_dairy", "name": "Dairy", "image": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400", "description": "Fresh dairy products", "order": 4},
    {"category_id": "cat_fruits", "name": "Fruits", "image": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400", "description": "Fresh seasonal fruits", "order": 5},
    {"category_id": "cat_vegetables", "name": "Vegetables", "image": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400", "description": "Farm fresh vegetables", "order": 6},
    {"category_id": "cat_beverages", "name": "Beverages", "image": "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400", "description": "Refreshing beverages", "order": 7},
    {"category_id": "cat_snacks", "name": "Snacks", "image": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400", "description": "Tasty snacks", "order": 8},
    {"category_id": "cat_essentials", "name": "Daily Essentials", "image": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400", "description": "Everyday essentials", "order": 9},
    {"category_id": "cat_personal", "name": "Personal Care", "image": "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400", "description": "Personal care products", "order": 10},
]

SEED_PRODUCTS = [
    {"product_id": "prod_basmati", "name": "Premium Basmati Rice", "description": "Long grain aromatic basmati rice, perfect for biryani and pulao", "price": 12.99, "discount": 10, "category_id": "cat_rice", "category_name": "Rice & Grains", "images": ["https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400"], "stock": 50, "unit": "kg", "featured": True},
    {"product_id": "prod_brown_rice", "name": "Organic Brown Rice", "description": "Healthy organic brown rice, rich in fiber", "price": 8.99, "discount": 5, "category_id": "cat_rice", "category_name": "Rice & Grains", "images": ["https://images.unsplash.com/photo-1536304993881-460e32a08e31?w=400"], "stock": 40, "unit": "kg", "featured": False},
    {"product_id": "prod_wheat_flour", "name": "Whole Wheat Flour", "description": "Premium chakki fresh atta for soft rotis", "price": 4.99, "discount": 0, "category_id": "cat_flour", "category_name": "Flour & Atta", "images": ["https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400"], "stock": 60, "unit": "kg", "featured": True},
    {"product_id": "prod_multigrain", "name": "Multigrain Flour", "description": "Nutritious multigrain flour blend", "price": 6.49, "discount": 15, "category_id": "cat_flour", "category_name": "Flour & Atta", "images": ["https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400"], "stock": 30, "unit": "kg", "featured": False},
    {"product_id": "prod_olive_oil", "name": "Extra Virgin Olive Oil", "description": "Cold pressed extra virgin olive oil", "price": 15.99, "discount": 20, "category_id": "cat_oil", "category_name": "Cooking Oil", "images": ["https://images.unsplash.com/photo-1474979266404-7eaacdc948b6?w=400"], "stock": 25, "unit": "liter", "featured": True},
    {"product_id": "prod_sunflower", "name": "Sunflower Oil", "description": "Light and healthy sunflower cooking oil", "price": 7.99, "discount": 10, "category_id": "cat_oil", "category_name": "Cooking Oil", "images": ["https://images.unsplash.com/photo-1474979266404-7eaacdc948b6?w=400"], "stock": 40, "unit": "liter", "featured": False},
    {"product_id": "prod_milk", "name": "Fresh Full Cream Milk", "description": "Farm fresh full cream milk", "price": 3.99, "discount": 0, "category_id": "cat_dairy", "category_name": "Dairy", "images": ["https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400"], "stock": 100, "unit": "liter", "featured": True},
    {"product_id": "prod_curd", "name": "Fresh Curd", "description": "Creamy and fresh homestyle curd", "price": 2.49, "discount": 0, "category_id": "cat_dairy", "category_name": "Dairy", "images": ["https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400"], "stock": 80, "unit": "kg", "featured": False},
    {"product_id": "prod_apple", "name": "Fresh Red Apples", "description": "Crisp and sweet Shimla apples", "price": 5.99, "discount": 5, "category_id": "cat_fruits", "category_name": "Fruits", "images": ["https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400"], "stock": 35, "unit": "kg", "featured": True},
    {"product_id": "prod_banana", "name": "Fresh Bananas", "description": "Ripe and sweet yellow bananas", "price": 1.99, "discount": 0, "category_id": "cat_fruits", "category_name": "Fruits", "images": ["https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400"], "stock": 50, "unit": "dozen", "featured": False},
    {"product_id": "prod_tomato", "name": "Fresh Tomatoes", "description": "Farm fresh red tomatoes", "price": 2.99, "discount": 10, "category_id": "cat_vegetables", "category_name": "Vegetables", "images": ["https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=400"], "stock": 60, "unit": "kg", "featured": True},
    {"product_id": "prod_onion", "name": "Red Onions", "description": "Fresh and firm red onions", "price": 1.49, "discount": 0, "category_id": "cat_vegetables", "category_name": "Vegetables", "images": ["https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400"], "stock": 70, "unit": "kg", "featured": False},
    {"product_id": "prod_potato", "name": "Fresh Potatoes", "description": "Clean and sorted fresh potatoes", "price": 1.29, "discount": 5, "category_id": "cat_vegetables", "category_name": "Vegetables", "images": ["https://images.unsplash.com/photo-1518977676601-b53f82ber1?w=400"], "stock": 80, "unit": "kg", "featured": False},
    {"product_id": "prod_tea", "name": "Premium Green Tea", "description": "Organic green tea for a healthy lifestyle", "price": 9.99, "discount": 15, "category_id": "cat_beverages", "category_name": "Beverages", "images": ["https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400"], "stock": 40, "unit": "piece", "featured": True},
    {"product_id": "prod_coffee", "name": "Arabica Coffee Beans", "description": "Premium roasted arabica coffee beans", "price": 14.99, "discount": 10, "category_id": "cat_beverages", "category_name": "Beverages", "images": ["https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400"], "stock": 30, "unit": "piece", "featured": False},
    {"product_id": "prod_chips", "name": "Classic Potato Chips", "description": "Crunchy salted potato chips", "price": 2.99, "discount": 0, "category_id": "cat_snacks", "category_name": "Snacks", "images": ["https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400"], "stock": 100, "unit": "piece", "featured": False},
    {"product_id": "prod_nuts", "name": "Mixed Dry Fruits", "description": "Premium quality mixed dry fruits and nuts", "price": 19.99, "discount": 20, "category_id": "cat_snacks", "category_name": "Snacks", "images": ["https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?w=400"], "stock": 25, "unit": "kg", "featured": True},
    {"product_id": "prod_sugar", "name": "Refined Sugar", "description": "Pure white refined sugar", "price": 3.49, "discount": 0, "category_id": "cat_essentials", "category_name": "Daily Essentials", "images": ["https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400"], "stock": 90, "unit": "kg", "featured": False},
    {"product_id": "prod_salt", "name": "Iodized Salt", "description": "Pure iodized crystal salt", "price": 1.29, "discount": 0, "category_id": "cat_essentials", "category_name": "Daily Essentials", "images": ["https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400"], "stock": 100, "unit": "kg", "featured": False},
    {"product_id": "prod_shampoo", "name": "Herbal Shampoo", "description": "Natural herbal shampoo for healthy hair", "price": 8.99, "discount": 25, "category_id": "cat_personal", "category_name": "Personal Care", "images": ["https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400"], "stock": 45, "unit": "piece", "featured": True},
    {"product_id": "prod_soap", "name": "Organic Bath Soap", "description": "Gentle organic soap with natural ingredients", "price": 3.49, "discount": 10, "category_id": "cat_personal", "category_name": "Personal Care", "images": ["https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400"], "stock": 60, "unit": "piece", "featured": False},
    {"product_id": "prod_coconut_oil", "name": "Pure Coconut Oil", "description": "Cold pressed pure coconut oil for hair and cooking", "price": 9.99, "discount": 15, "category_id": "cat_oil", "category_name": "Cooking Oil", "images": ["https://images.unsplash.com/photo-1474979266404-7eaacdc948b6?w=400"], "stock": 35, "unit": "liter", "featured": True},
]

SEED_COUPONS = [
    {"coupon_id": "coupon_welcome", "code": "WELCOME10", "discount_percent": 10, "min_order": 10, "max_discount": 5, "active": True},
    {"coupon_id": "coupon_fresh", "code": "FRESH20", "discount_percent": 20, "min_order": 25, "max_discount": 10, "active": True},
]

async def seed_data():
    admin_email = ADMIN_EMAIL.lower()
    existing_admin = await db.users.find_one({"email": admin_email}, {"_id": 0})
    if not existing_admin:
        admin_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": admin_id, "email": admin_email,
            "password_hash": hash_password(ADMIN_PASSWORD), "name": "Admin",
            "role": "admin", "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif existing_admin.get("password_hash") and not verify_password(ADMIN_PASSWORD, existing_admin["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
        logger.info("Admin password updated")
    existing_cats = await db.categories.count_documents({})
    if existing_cats == 0:
        for cat in SEED_CATEGORIES:
            await db.categories.insert_one(cat.copy())
        logger.info(f"Seeded {len(SEED_CATEGORIES)} categories")
    existing_prods = await db.products.count_documents({})
    if existing_prods == 0:
        for prod in SEED_PRODUCTS:
            p = prod.copy()
            p["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.products.insert_one(p)
        logger.info(f"Seeded {len(SEED_PRODUCTS)} products")
    existing_coupons = await db.coupons.count_documents({})
    if existing_coupons == 0:
        for coupon in SEED_COUPONS:
            await db.coupons.insert_one(coupon.copy())
        logger.info(f"Seeded {len(SEED_COUPONS)} coupons")
    creds_path = Path("/app/memory/test_credentials.md")
    creds_path.parent.mkdir(parents=True, exist_ok=True)
    creds_path.write_text(f"""# Test Credentials
## Admin Account
- Email: {admin_email}
- Password: {ADMIN_PASSWORD}
- Role: admin
## Test User
- Register via /api/auth/register or Google Sign-in
## Coupon Codes
- WELCOME10: 10% off (min $10, max $5 off)
- FRESH20: 20% off (min $25, max $10 off)
## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/google-session
""")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.categories.create_index("category_id", unique=True)
    await db.products.create_index("product_id", unique=True)
    await db.products.create_index("category_id")
    await db.orders.create_index("user_id")
    await db.orders.create_index("order_id", unique=True)
    await db.addresses.create_index("user_id")
    await db.addresses.create_index("address_id", unique=True)
    await db.carts.create_index("user_id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.payment_transactions.create_index("session_id")
    await db.wishlists.create_index("user_id", unique=True)
    await db.push_tokens.create_index("user_id", unique=True)
    await db.notifications.create_index("user_id")
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.images.create_index("image_id", unique=True)
    await seed_data()
    logger.info("Application started successfully")

@app.on_event("shutdown")
async def shutdown():
    client.close()

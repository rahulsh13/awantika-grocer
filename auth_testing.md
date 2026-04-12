# Auth Testing Playbook

## Step 1: MongoDB Verification
```bash
mongosh --eval "
use('test_database');
db.users.find({role: 'admin'}).pretty();
"
```

## Step 2: API Testing
```bash
# Login as admin
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@freshmart.com","password":"Admin@123"}'

# Use the token from login response
TOKEN="<token_from_login>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/auth/me
```

## Step 3: Test protected endpoints
```bash
TOKEN="<token_from_login>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/cart
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/addresses
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/orders
```

# PhishGuard API Authentication Guide

PhishGuard implements standard OAuth2 password flow with JWT bearer authentication tokens to protect endpoint routes.

---

## 🔑 Authentication Endpoints

All authentication routes are prefixed with `/api/v1/auth`:

### 1. User Registration (`POST /api/v1/auth/register`)
Creates a new active user account.
* **Format**: JSON
* **Request Schema**:
  ```json
  {
    "email": "user@example.com",
    "password": "strong-password",
    "confirm_password": "strong-password"
  }
  ```
* **Response Status**: `201 Created`

### 2. User Login (`POST /api/v1/auth/login`)
Accepts credentials and returns JWT bearer tokens.
* **Format**: `application/x-www-form-urlencoded`
* **Request Schema**:
  ```text
  username=user@example.com
  password=strong-password
  ```
* **Response Body**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1...",
    "token_type": "bearer",
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "role": "user",
      "is_active": true
    }
  }
  ```

### 3. Current User Session (`GET /api/v1/auth/me`)
Returns current authenticated user details.
* **Headers**: `Authorization: Bearer <token>`

---

## 🛠️ Testing Authentication Locally

Verify authentication endpoint integrity using `curl`:

1. **Register User**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"demo@example.com\",\"password\":\"Example-password-123\",\"confirm_password\":\"Example-password-123\"}"
   ```

2. **Login Form Request**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=demo%40example.com&password=Example-password-123"
   ```

3. **Query Current User Profile**:
   ```bash
   curl http://localhost:8000/api/v1/auth/me \
     -H "Authorization: Bearer <token>"
   ```

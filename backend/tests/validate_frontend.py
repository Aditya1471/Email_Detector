import os
import sys


def validate_frontend():
    print("=== PhishGuard Frontend Asset Validation ===")

    # Define required files
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
    required_files = [
        "index.html",
        "scan.html",
        "result.html",
        "dashboard.html",
        "login.html",
        "register.html",
        "about.html",
        "404.html",
        "css/variables.css",
        "css/base.css",
        "js/api.js",
        "js/auth.js",
    ]

    missing_files = []
    for rel_path in required_files:
        full_path = os.path.join(frontend_dir, rel_path)
        if not os.path.exists(full_path):
            missing_files.append(rel_path)
            print(f"[MISSING] Required file: {rel_path}")
        else:
            print(f"[OK] Verified: {rel_path}")

    if missing_files:
        print("[FAIL] Frontend validation failed due to missing files.")
        return False

    # Check api.js to ensure no staging/production mock fallback or committed secrets
    api_js_path = os.path.join(frontend_dir, "js", "api.js")
    if os.path.exists(api_js_path):
        with open(api_js_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Verify no secrets or private keys lookalikes
            if "secret_key" in content.lower() or "private_key" in content.lower():
                print("[FAIL] Warning: Potential secret keys/tokens detected inside js/api.js")
                return False

    print("[SUCCESS] All frontend assets and file structural checks passed successfully!")
    return True


if __name__ == "__main__":
    success = validate_frontend()
    if not success:
        sys.exit(1)
    sys.exit(0)

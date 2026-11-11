#!/usr/bin/env python3
"""Fetch Gumroad products & sales and write an aggregate-only public JSON file.

The access token is read from GUMROAD_ACCESS_TOKEN and is never written to the
output, logs, or filenames. Buyer PII (emails, names, IPs, addresses, etc.) is
stripped by allow-list; the public file contains only product name, amounts,
timestamps, and a coarse source/referrer bucket.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

API = "https://api.gumroad.com/v2"
TZ = ZoneInfo("America/Chicago")
SEASON_START = date(2026, 11, 10)
DEADLINE = date(2026, 11, 30)
GOAL = 5000
CURRENCY = "usd"

# Display names keyed by Gumroad custom permalink (also accepts local folder slugs).
CATALOG: dict[str, dict[str, Any]] = {
    "holiday-meal-planner": {
        "title": "Holiday Meal Planner",
        "product_type": "planner",
        "niche": "Holiday meals",
        "url": "https://agencyr.gumroad.com/l/holiday-meal-planner",
    },
    "black-friday-budget-tracker": {
        "title": "Black Friday Budget Tracker",
        "product_type": "spreadsheet",
        "niche": "Holiday budgeting",
        "url": "https://agencyr.gumroad.com/l/black-friday-budget-tracker",
    },
    "advent-activity-calendar": {
        "title": "Advent Activity Calendar",
        "product_type": "printable",
        "niche": "Family advent",
        "url": "https://agencyr.gumroad.com/l/advent-activity-calendar",
    },
    "christmas-gift-tracker": {
        "title": "Christmas Gift Tracker",
        "product_type": "spreadsheet",
        "niche": "Gift planning",
        "url": "https://agencyr.gumroad.com/l/christmas-gift-tracker",
    },
    "secret-santa-printable-kit": {
        "title": "Secret Santa Printable Kit",
        "product_type": "printable",
        "niche": "Secret Santa",
        "url": "https://agencyr.gumroad.com/l/secret-santa-printable-kit",
    },
    "secret-santa-kit": {
        "title": "Secret Santa Printable Kit",
        "product_type": "printable",
        "niche": "Secret Santa",
        "url": "https://agencyr.gumroad.com/l/secret-santa-printable-kit",
    },
    "holiday-planner-bundle": {
        "title": "Holiday Planner Bundle",
        "product_type": "bundle",
        "niche": "Holiday planning",
        "url": "https://agencyr.gumroad.com/l/holiday-planner-bundle",
    },
    "holiday-bundle": {
        "title": "Holiday Planner Bundle",
        "product_type": "bundle",
        "niche": "Holiday planning",
        "url": "https://agencyr.gumroad.com/l/holiday-planner-bundle",
    },
}

# Fields that may be read from a sale record. Everything else is ignored.
SALE_ALLOW = {
    "id",
    "product_id",
    "product_name",
    "permalink",
    "price",
    "quantity",
    "gumroad_fee",
    "discover_fee",
    "formatted_display_price",
    "formatted_total_price",
    "currency",
    "refunded",
    "partially_refunded",
    "charged_back",
    "timestamp",
    "created_at",
    "daystamp",
    "referrer",
    "order_number",
}

PII_KEY_RE = re.compile(
    r"(email|e-mail|full_?name|first_?name|last_?name|buyer|purchaser|payer|"
    r"\bip\b|address|street|phone|tel\b|card|license|zip|postal|shipping|"
    r"tax_?id|vat|ssn|password|token|secret|credit)",
    re.I,
)
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


class SyncError(RuntimeError):
    pass


def log(msg: str) -> None:
    """Print a short status line. Never pass API payloads or secrets here."""
    print(msg, file=sys.stderr)


def cents_to_dollars(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        n = float(value)
    except (TypeError, ValueError):
        return 0.0
    # Gumroad prices/fees are integer cents. A rare already-dollar float (< 1000
    # and not an int) is used as-is; otherwise divide by 100.
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, int) or (isinstance(value, float) and value.is_integer()):
        return round(n / 100.0, 2)
    return round(n, 2)


def api_get(token: str, path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
    q = {"access_token": token}
    if params:
        q.update(params)
    url = API + path + "?" + urllib.parse.urlencode(q)
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "holiday-swarm-dashboard-sync/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Do not include the request URL (it has the token) or the body.
        raise SyncError(f"Gumroad {path} returned HTTP {e.code}") from None
    except urllib.error.URLError:
        raise SyncError(f"Gumroad {path} was unreachable") from None
    if not payload.get("success", True):
        raise SyncError(f"Gumroad {path} returned success=false")
    return payload


def fetch_products(token: str) -> list[dict[str, Any]]:
    data = api_get(token, "/products")
    return list(data.get("products") or [])


def fetch_sales(token: str) -> list[dict[str, Any]]:
    sales: list[dict[str, Any]] = []
    page = 1
    while page <= 1000:
        data = api_get(token, "/sales", {"page": str(page)})
        batch = list(data.get("sales") or [])
        if not batch:
            break
        sales.extend(batch)
        next_url = data.get("next_page_url") or data.get("next_page")
        # Stop when the API does not advertise another page and this page is
        # short, or when a full page would otherwise repeat forever.
        if not next_url and len(batch) < 10:
            break
        page += 1
    return sales


def permalink_of(product: dict[str, Any]) -> str:
    handle = (product.get("custom_permalink") or "").strip()
    if handle:
        return handle
    short = (product.get("short_url") or product.get("url") or product.get("landing_url") or "").rstrip("/")
    if short:
        return short.rsplit("/", 1)[-1]
    return ""


def pick_sale(raw: dict[str, Any]) -> dict[str, Any]:
    return {k: raw[k] for k in SALE_ALLOW if k in raw}


def parse_sale_time(sale: dict[str, Any]) -> datetime | None:
    for key in ("created_at", "timestamp"):
        val = sale.get(key)
        if not val or not isinstance(val, str):
            continue
        text = val.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    day = sale.get("daystamp")
    if isinstance(day, str) and day:
        try:
            d = date.fromisoformat(day[:10])
            return datetime(d.year, d.month, d.day, tzinfo=TZ)
        except ValueError:
            return None
    return None


def classify_source(referrer: Any, discover_fee_cents: Any) -> str:
    try:
        fee = float(discover_fee_cents or 0)
    except (TypeError, ValueError):
        fee = 0.0
    if fee > 0:
        return "discover"

    r = (referrer or "").strip() if isinstance(referrer, str) else ""
    if not r or r in {"-", "direct", "direct traffic", "none", "null"}:
        return "direct"
    low = r.lower()

    utm = ""
    try:
        parsed = urllib.parse.urlparse(r if "://" in r else f"https://placeholder/?{r}")
        qs = urllib.parse.parse_qs(parsed.query)
        utm = (qs.get("utm_source") or qs.get("source") or [""])[0].lower()
    except Exception:
        utm = ""

    def bucket(s: str) -> str | None:
        if not s:
            return None
        if "pin" in s or "pinterest" in s:
            return "pinterest"
        if any(x in s for x in ("instagram", "instagram.com", "facebook", "fb.com", "twitter", "x.com", "tiktok", "threads", "reddit", "linkedin", "youtube", "social")):
            return "social"
        if any(x in s for x in ("email", "mail", "newsletter", "beehiiv", "substack", "convertkit")):
            return "email"
        if "discover" in s or s == "gumroad":
            return "discover"
        if any(x in s for x in ("google", "bing", "duckduckgo", "yahoo", "seo", "organic")):
            return "organic"
        if s in {"direct", "none"}:
            return "direct"
        return None

    hit = bucket(utm)
    if hit:
        return hit
    if "discover" in low and "gumroad" in low:
        return "discover"
    hit = bucket(low)
    if hit:
        return hit
    if "gumroad.com" in low:
        return "direct"
    return "organic"


def public_id(product: str, ts: str, amount: float, index: int) -> str:
    raw = f"{product}|{ts}|{amount:.2f}|{index}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def is_voided(sale: dict[str, Any]) -> bool:
    return bool(sale.get("refunded") or sale.get("charged_back"))


def money(n: float) -> float:
    return round(float(n) + 0.0, 2)


def build_snapshot(products_raw: list[dict[str, Any]], sales_raw: list[dict[str, Any]]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    today = datetime.now(TZ).date()
    end = today if today <= DEADLINE else DEADLINE
    start = SEASON_START
    days: list[date] = []
    d = start
    last = end if end >= start else start
    while d <= last:
        days.append(d)
        d += timedelta(days=1)

    # Seed product rows from the known catalog, then fill in live Gumroad data.
    by_permalink: dict[str, dict[str, Any]] = {}
    seen_handles: set[str] = set()

    def ensure(permalink: str, name: str, price: float, url: str, product_type: str, niche: str) -> dict[str, Any]:
        handle = permalink or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        if handle in by_permalink:
            row = by_permalink[handle]
            if price and not row["price"]:
                row["price"] = price
            if name and row["name"] == handle:
                row["name"] = name
            return row
        meta = CATALOG.get(handle, {})
        row = {
            "permalink": handle,
            "name": meta.get("title") or name or handle,
            "url": meta.get("url") or url or (f"https://agencyr.gumroad.com/l/{handle}" if handle else None),
            "price": price,
            "product_type": meta.get("product_type") or product_type or "digital",
            "niche": meta.get("niche") or niche or "",
            "sales": 0,
            "gross_revenue": 0.0,
            "net_revenue": 0.0,
            "published": True,
        }
        by_permalink[handle] = row
        return row

    for handle, meta in CATALOG.items():
        # Prefer the public Gumroad permalink as the canonical key.
        if handle in {"secret-santa-kit", "holiday-bundle"}:
            continue
        ensure(handle, meta["title"], 0.0, meta["url"], meta["product_type"], meta["niche"])

    for p in products_raw:
        handle = permalink_of(p)
        if not handle or p.get("deleted"):
            continue
        seen_handles.add(handle)
        price = cents_to_dollars(p.get("price"))
        name = p.get("name") if isinstance(p.get("name"), str) else handle
        url = p.get("short_url") or (CATALOG.get(handle) or {}).get("url") or ""
        ensure(handle, name, price, url, "digital", "")
        by_permalink[handle]["published"] = bool(p.get("published", True))

    daily: dict[str, dict[str, float]] = {
        d.isoformat(): {"date": d.isoformat(), "gross": 0.0, "net": 0.0, "orders": 0} for d in days
    }
    sources: dict[str, dict[str, float]] = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
    recent: list[dict[str, Any]] = []
    gross_total = 0.0
    net_total = 0.0
    orders_total = 0
    refunds_total = 0
    net_known = True
    fees_seen = False

    for i, raw in enumerate(sales_raw):
        sale = pick_sale(raw)
        handle = (sale.get("permalink") or "").strip()
        if not handle and isinstance(sale.get("product_name"), str):
            # Fall back later via product name; still create a row.
            handle = ""
        name = sale.get("product_name") if isinstance(sale.get("product_name"), str) else handle
        product_row = ensure(handle or "unknown", name or "Unknown product", 0.0, "", "digital", "")
        handle = product_row["permalink"]

        qty = sale.get("quantity") or 1
        try:
            qty = int(qty)
        except (TypeError, ValueError):
            qty = 1
        amount = cents_to_dollars(sale.get("price"))
        fee = sale.get("gumroad_fee")
        disc = sale.get("discover_fee")
        if fee is None and disc is None:
            net = amount
            net_known = False
        else:
            fees_seen = True
            net = money(amount - cents_to_dollars(fee) - cents_to_dollars(disc))
        ts = parse_sale_time(sale)
        ts_iso = ts.astimezone(TZ).isoformat() if ts else None
        day_key = ts.astimezone(TZ).date().isoformat() if ts else (sale.get("daystamp") if isinstance(sale.get("daystamp"), str) else None)
        source = classify_source(sale.get("referrer"), sale.get("discover_fee"))

        if is_voided(sale) or sale.get("partially_refunded"):
            # Full voids drop out of totals. Partial refunds are also excluded
            # because the public API does not always expose the refunded amount.
            refunds_total += max(qty, 1)
            continue

        product_row["sales"] += max(qty, 1)
        product_row["gross_revenue"] = money(product_row["gross_revenue"] + amount)
        product_row["net_revenue"] = money(product_row["net_revenue"] + net)
        gross_total = money(gross_total + amount)
        net_total = money(net_total + net)
        orders_total += max(qty, 1)
        if day_key:
            if day_key not in daily:
                daily[day_key] = {"date": day_key, "gross": 0.0, "net": 0.0, "orders": 0}
            daily[day_key]["gross"] = money(daily[day_key]["gross"] + amount)
            daily[day_key]["net"] = money(daily[day_key]["net"] + net)
            daily[day_key]["orders"] = int(daily[day_key]["orders"] + max(qty, 1))
        sources[source]["orders"] = int(sources[source]["orders"] + max(qty, 1))
        sources[source]["revenue"] = money(sources[source]["revenue"] + amount)

        recent.append(
            {
                "id": public_id(handle, ts_iso or "", amount, i),
                "product": product_row["name"],
                "amount": amount,
                "net": net,
                "ts": ts_iso,
                "source": source,
            }
        )

    # Sort recent newest first; cap the public feed.
    def ts_key(row: dict[str, Any]) -> str:
        return row.get("ts") or ""

    recent.sort(key=ts_key, reverse=True)
    recent = recent[:50]

    daily_list = [daily[k] for k in sorted(daily)]
    # Cumulative series for the sparkline (gross).
    running = 0.0
    revenue_series: list[float] = []
    for row in daily_list:
        running = money(running + row["gross"])
        revenue_series.append(running)

    product_list = sorted(
        by_permalink.values(),
        key=lambda r: (-r["gross_revenue"], r["name"]),
    )
    for row in product_list:
        row["gross_revenue"] = money(row["gross_revenue"])
        row["net_revenue"] = money(row["net_revenue"])
        row["price"] = money(row["price"])

    source_out = {
        k: {"orders": int(v["orders"]), "revenue": money(v["revenue"])}
        for k, v in sorted(sources.items())
    }

    snapshot = {
        "updated_at": now.isoformat().replace("+00:00", "Z"),
        "timezone": "America/Chicago",
        "currency": CURRENCY,
        "goal": GOAL,
        "deadline": DEADLINE.isoformat(),
        "season_start": SEASON_START.isoformat(),
        "gross_revenue": money(gross_total),
        "net_revenue": money(net_total) if (fees_seen or gross_total == 0) else money(gross_total),
        "net_after_fees": bool(fees_seen) or gross_total == 0,
        "orders": orders_total,
        "refunds": refunds_total,
        "products": product_list,
        "daily": daily_list,
        "revenue_series": revenue_series,
        "recent_sales": recent,
        "sources": source_out,
    }
    # With zero sales, net equals gross and is known.
    if not fees_seen and gross_total == 0:
        snapshot["net_after_fees"] = True
        snapshot["net_revenue"] = 0.0
    elif not net_known and not fees_seen:
        snapshot["net_after_fees"] = False
        snapshot["net_revenue"] = money(gross_total)
    return snapshot


def assert_no_pii(obj: Any, path: str = "$") -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if PII_KEY_RE.search(str(k)):
                raise SyncError(f"Refusing to publish possible PII key at {path}.{k}")
            assert_no_pii(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            assert_no_pii(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        if EMAIL_RE.search(obj):
            raise SyncError(f"Refusing to publish a string that looks like an email at {path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Write an aggregate-only Gumroad sales snapshot.")
    parser.add_argument("--out", required=True, help="Path to write sales.json")
    args = parser.parse_args()

    token = os.environ.get("GUMROAD_ACCESS_TOKEN") or ""
    if not token.strip():
        log("GUMROAD_ACCESS_TOKEN is missing")
        return 1

    try:
        products = fetch_products(token)
        sales = fetch_sales(token)
        log(f"fetched {len(products)} products, {len(sales)} sales")
        snapshot = build_snapshot(products, sales)
        assert_no_pii(snapshot)
    except SyncError as e:
        log(str(e))
        return 1

    out_path = args.out
    parent = os.path.dirname(os.path.abspath(out_path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, indent=2, allow_nan=False)
        fh.write("\n")
    os.replace(tmp, out_path)
    log(
        "wrote snapshot: "
        f"gross={snapshot['gross_revenue']} net={snapshot['net_revenue']} "
        f"orders={snapshot['orders']} products={len(snapshot['products'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

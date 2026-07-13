#api/utis.py
import io
import random
import string
from datetime import date

import qrcode
from django.core.files.base import ContentFile


def _random_suffix(length=4):
    return "".join(random.choices(string.digits, k=length))


def generate_hospital_number():
    """Format: HOS-YYYY-XXXXX e.g. HOS-2026-00042"""
    from api.models import Patient

    year = date.today().year
    count = Patient.all_objects.filter(created_at__year=year).count() + 1
    return f"HOS-{year}-{count:05d}"


def generate_visit_number():
    from api.models import Visit

    today = date.today()
    prefix = f"VN-{today.strftime('%Y%m%d')}"
    count = Visit.all_objects.filter(created_at__date=today).count() + 1
    return f"{prefix}-{count:04d}"


def generate_invoice_number():
    from api.models import Invoice

    today = date.today()
    prefix = f"INV-{today.strftime('%Y%m%d')}"
    count = Invoice.all_objects.filter(created_at__date=today).count() + 1
    return f"{prefix}-{count:04d}"


def generate_receipt_number():
    from api.models import Payment

    today = date.today()
    prefix = f"RCT-{today.strftime('%Y%m%d')}"
    count = Payment.all_objects.filter(created_at__date=today).count() + 1
    return f"{prefix}-{count:04d}"


def generate_qr_code(data: str, filename: str) -> ContentFile:
    """Generates a PNG QR code image and returns it as a Django ContentFile."""
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return ContentFile(buffer.getvalue(), name=f"{filename}.png")


def calculate_bmi(weight_kg, height_cm):
    if not weight_kg or not height_cm:
        return None
    weight_kg = float(weight_kg)
    height_cm = float(height_cm)
    height_m = height_cm / 100
    if height_m <= 0:
        return None
    return round(weight_kg / (height_m ** 2), 2)


def calculate_age(dob):
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

def generate_otc_sale_number():
    """
    Generate OTC Sale Number
    Format: OTC-YYYYMMDD-0001
    Example: OTC-20260712-0001
    """
    from api.models import OTCSale

    today = date.today()
    prefix = f"OTC-{today.strftime('%Y%m%d')}"
    count = OTCSale.all_objects.filter(created_at__date=today).count() + 1
    return f"{prefix}-{count:04d}"
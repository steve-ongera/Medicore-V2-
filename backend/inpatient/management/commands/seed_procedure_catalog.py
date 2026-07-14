from decimal import Decimal

from django.core.management.base import BaseCommand

from inpatient.models import ProcedureCatalog


PROCEDURES = [
    # General
    ("PROC001", "Wound Dressing", 500),
    ("PROC002", "Suturing", 1500),
    ("PROC003", "Incision and Drainage", 2500),
    ("PROC004", "Abscess Drainage", 2500),
    ("PROC005", "Foreign Body Removal", 1800),

    # Emergency
    ("PROC006", "CPR (Cardiopulmonary Resuscitation)", 5000),
    ("PROC007", "Oxygen Therapy", 800),
    ("PROC008", "Nebulization", 700),
    ("PROC009", "IV Cannulation", 500),
    ("PROC010", "Urinary Catheterization", 1200),

    # Theatre / Minor Surgery
    ("PROC011", "Minor Surgical Procedure", 5000),
    ("PROC012", "Appendectomy", 25000),
    ("PROC013", "Hernia Repair", 30000),
    ("PROC014", "Hydrocelectomy", 18000),
    ("PROC015", "Circumcision", 6000),

    # Orthopaedics
    ("PROC016", "POP Application", 3500),
    ("PROC017", "Fracture Reduction", 12000),
    ("PROC018", "Joint Aspiration", 4000),

    # Obstetrics & Gynaecology
    ("PROC019", "Normal Delivery", 12000),
    ("PROC020", "Caesarean Section", 55000),
    ("PROC021", "Manual Vacuum Aspiration", 7000),
    ("PROC022", "Episiotomy Repair", 5000),

    # Paediatrics
    ("PROC023", "Neonatal Resuscitation", 6000),
    ("PROC024", "Phototherapy", 8000),

    # ENT
    ("PROC025", "Ear Syringing", 1000),
    ("PROC026", "Nasal Packing", 1500),

    # Ophthalmology
    ("PROC027", "Eye Irrigation", 1000),
    ("PROC028", "Foreign Body Removal (Eye)", 2500),

    # Dental
    ("PROC029", "Tooth Extraction", 2500),
    ("PROC030", "Dental Dressing", 1200),

    # Inpatient Care
    ("PROC031", "Blood Transfusion", 5000),
    ("PROC032", "NG Tube Insertion", 1500),
    ("PROC033", "Chest Tube Insertion", 12000),
    ("PROC034", "Lumbar Puncture", 7000),
    ("PROC035", "Central Line Insertion", 10000),

    # ICU
    ("PROC036", "Mechanical Ventilation", 20000),
    ("PROC037", "Intubation", 6000),

    # Miscellaneous
    ("PROC038", "Biopsy", 7000),
    ("PROC039", "Skin Lesion Excision", 4500),
    ("PROC040", "Burn Dressing", 3000),
    ("PROC041", "Drain Removal", 1000),
    ("PROC042", "Stitch Removal", 500),
    ("PROC043", "Pressure Ulcer Care", 2500),
    ("PROC044", "Tracheostomy Care", 4000),
    ("PROC045", "Pleural Tap", 6000),
    ("PROC046", "Ascitic Tap", 6000),
    ("PROC047", "Dialysis Session", 9000),
    ("PROC048", "ECG Procedure", 1000),
    ("PROC049", "Endoscopy", 12000),
    ("PROC050", "Colonoscopy", 18000),
]


class Command(BaseCommand):
    help = "Seed inpatient procedure catalog"

    def handle(self, *args, **options):
        created = 0
        updated = 0

        for code, name, price in PROCEDURES:
            obj, was_created = ProcedureCatalog.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "price": Decimal(str(price)),
                    "is_active": True,
                },
            )

            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created: {created}, Updated: {updated}"
            )
        )
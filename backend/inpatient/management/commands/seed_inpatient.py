import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import User, Role, Patient, Medicine
from inpatient.models import (
    Ward, WardType, GenderRestriction, Bed, BedStatus,
    Admission, AdmissionType, AdmissionStatus,
    WardRound, NursingNote, Shift, InpatientVitals,
    MedicationOrder, MedicationRoute, MedicationAdministration, AdministrationStatus,
    BedTransfer, BedCharge,
)

# ---------------------------------------------------------------------------
# Fixture data: wards + how many beds each should have
# ---------------------------------------------------------------------------
WARD_DEFINITIONS = [
    {"name": "General Ward A", "ward_type": WardType.GENERAL, "floor": "1st Floor",
     "gender_restriction": GenderRestriction.MALE, "default_daily_rate": 2500, "beds": 12},
    {"name": "General Ward B", "ward_type": WardType.GENERAL, "floor": "1st Floor",
     "gender_restriction": GenderRestriction.FEMALE, "default_daily_rate": 2500, "beds": 12},
    {"name": "Maternity Ward", "ward_type": WardType.MATERNITY, "floor": "2nd Floor",
     "gender_restriction": GenderRestriction.FEMALE, "default_daily_rate": 3500, "beds": 10},
    {"name": "Pediatric Ward", "ward_type": WardType.PEDIATRIC, "floor": "2nd Floor",
     "gender_restriction": GenderRestriction.MIXED, "default_daily_rate": 3000, "beds": 10},
    {"name": "Surgical Ward", "ward_type": WardType.SURGICAL, "floor": "3rd Floor",
     "gender_restriction": GenderRestriction.MIXED, "default_daily_rate": 4000, "beds": 8},
    {"name": "ICU", "ward_type": WardType.ICU, "floor": "4th Floor",
     "gender_restriction": GenderRestriction.MIXED, "default_daily_rate": 15000, "beds": 6},
    {"name": "HDU", "ward_type": WardType.HDU, "floor": "4th Floor",
     "gender_restriction": GenderRestriction.MIXED, "default_daily_rate": 9000, "beds": 6},
    {"name": "Isolation Ward", "ward_type": WardType.ISOLATION, "floor": "Ground Floor",
     "gender_restriction": GenderRestriction.MIXED, "default_daily_rate": 5000, "beds": 4},
    {"name": "Private Wing", "ward_type": WardType.PRIVATE, "floor": "5th Floor",
     "gender_restriction": GenderRestriction.MIXED, "default_daily_rate": 8000, "beds": 8},
]

ADMISSION_DIAGNOSES = [
    "Malaria with complications", "Community-acquired pneumonia", "Typhoid fever",
    "Post-operative recovery - appendectomy", "Hypertensive emergency", "Diabetic ketoacidosis",
    "Road traffic accident - multiple fractures", "Severe dehydration / gastroenteritis",
    "Obstructed labour", "Preterm labour", "Acute exacerbation of asthma",
    "Chronic kidney disease - stage 4", "Suspected meningitis", "Sickle cell crisis",
]

DOSAGES = ["500mg", "250mg", "1g", "10mg", "5mg", "20mg"]
FREQUENCIES = ["Every 8 hours", "Every 12 hours", "Once daily", "Every 6 hours", "Twice daily"]


class Command(BaseCommand):
    help = "Seeds inpatient/wards demo data: wards, beds, and sample admissions built from existing patients/doctors."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush", action="store_true",
            help="Delete all existing inpatient data before seeding (wards, beds, admissions, etc.).",
        )
        parser.add_argument(
            "--admissions", type=int, default=15,
            help="Number of sample admissions to create (default: 15). Requires existing Patients and Doctors.",
        )
        parser.add_argument(
            "--wards-only", action="store_true",
            help="Only seed Wards + Beds, skip creating sample Admissions.",
        )

    def handle(self, *args, **options):
        if options["flush"]:
            self._flush()

        with transaction.atomic():
            wards = self._seed_wards()
            self._seed_beds(wards)

        if not options["wards_only"]:
            self._seed_admissions(options["admissions"])

        self.stdout.write(self.style.SUCCESS("Inpatient seed data created successfully."))

    # -----------------------------------------------------------------
    def _flush(self):
        self.stdout.write("Flushing existing inpatient data...")
        MedicationAdministration.objects.all().delete()
        MedicationOrder.objects.all().delete()
        InpatientVitals.objects.all().delete()
        NursingNote.objects.all().delete()
        WardRound.objects.all().delete()
        BedCharge.objects.all().delete()
        BedTransfer.objects.all().delete()
        Admission.objects.all().delete()
        Bed.objects.all().delete()
        Ward.objects.all().delete()
        self.stdout.write(self.style.WARNING("Existing inpatient data flushed."))

    # -----------------------------------------------------------------
    def _seed_wards(self):
        wards = {}
        for definition in WARD_DEFINITIONS:
            ward, created = Ward.objects.get_or_create(
                name=definition["name"],
                defaults={
                    "ward_type": definition["ward_type"],
                    "floor": definition["floor"],
                    "gender_restriction": definition["gender_restriction"],
                    "default_daily_rate": definition["default_daily_rate"],
                },
            )
            wards[definition["name"]] = ward
            if created:
                self.stdout.write(f"  + Ward created: {ward.name}")
        return wards

    def _seed_beds(self, wards):
        for definition in WARD_DEFINITIONS:
            ward = wards[definition["name"]]
            prefix = "".join(w[0] for w in ward.name.split())  # e.g. "General Ward A" -> "GWA"
            for i in range(1, definition["beds"] + 1):
                bed_number = f"{prefix}-{i:02d}"
                bed, created = Bed.objects.get_or_create(
                    ward=ward, bed_number=bed_number,
                    defaults={"status": BedStatus.AVAILABLE},
                )
                if created:
                    self.stdout.write(f"    + Bed created: {ward.name} / {bed_number}")

    # -----------------------------------------------------------------
    def _seed_admissions(self, count):
        doctors = list(User.objects.filter(role=Role.DOCTOR, is_active_staff=True))
        nurses = list(User.objects.filter(role=Role.NURSE, is_active_staff=True))
        receptionists = list(User.objects.filter(role=Role.RECEPTIONIST, is_active_staff=True))
        patients = list(Patient.objects.all())
        medicines = list(Medicine.objects.all())
        available_beds = list(Bed.objects.filter(status=BedStatus.AVAILABLE).select_related("ward"))

        if not doctors:
            self.stdout.write(self.style.WARNING("No DOCTOR users found — skipping sample admissions. Seed users first."))
            return
        if not patients:
            self.stdout.write(self.style.WARNING("No Patients found — skipping sample admissions. Seed patients first."))
            return
        if not available_beds:
            self.stdout.write(self.style.WARNING("No available beds found — skipping sample admissions."))
            return

        count = min(count, len(available_beds), len(patients))
        chosen_patients = random.sample(patients, count)
        chosen_beds = random.sample(available_beds, count)

        created_count = 0
        for patient, bed in zip(chosen_patients, chosen_beds):
            admitting_doctor = random.choice(doctors)
            attending_doctor = random.choice(doctors)
            admitted_by = random.choice(receptionists) if receptionists else admitting_doctor

            admission_type = random.choice(list(AdmissionType.values))
            days_ago = random.randint(0, 6)
            admission = Admission.objects.create(
                patient=patient,
                bed=bed,
                admitting_doctor=admitting_doctor,
                attending_doctor=attending_doctor,
                admitted_by=admitted_by,
                admission_type=admission_type,
                admission_diagnosis=random.choice(ADMISSION_DIAGNOSES),
                expected_discharge_date=(timezone.now() + timedelta(days=random.randint(1, 10))).date(),
            )
            # Backdate admission_date realistically (auto_now_add bypass via update)
            Admission.objects.filter(pk=admission.pk).update(
                admission_date=timezone.now() - timedelta(days=days_ago, hours=random.randint(0, 23))
            )
            admission.refresh_from_db()

            bed.status = BedStatus.OCCUPIED
            bed.save(update_fields=["status"])

            # Ward round
            if nurses or doctors:
                WardRound.objects.create(
                    admission=admission, doctor=attending_doctor,
                    notes=f"Patient stable, responding to treatment for {admission.admission_diagnosis.lower()}.",
                    plan="Continue current management, review in 24 hours.",
                )

            # Nursing note
            if nurses:
                NursingNote.objects.create(
                    admission=admission, nurse=random.choice(nurses),
                    shift=random.choice(list(Shift.values)),
                    note="Vitals stable. Patient comfortable, tolerating oral intake.",
                )

            # Vitals
            InpatientVitals.objects.create(
                admission=admission,
                shift=random.choice(list(Shift.values)),
                weight_kg=round(random.uniform(45, 90), 1),
                height_cm=round(random.uniform(150, 185), 1),
                temperature_c=round(random.uniform(36.2, 38.5), 1),
                pulse_bpm=random.randint(60, 110),
                respiratory_rate=random.randint(14, 24),
                bp_systolic=random.randint(100, 140),
                bp_diastolic=random.randint(60, 90),
                oxygen_saturation=random.randint(93, 100),
                recorded_by=random.choice(nurses) if nurses else attending_doctor,
            )

            # Medication order (+ occasional administration record)
            if medicines:
                medicine = random.choice(medicines)
                med_order = MedicationOrder.objects.create(
                    admission=admission,
                    medicine=medicine,
                    dosage=random.choice(DOSAGES),
                    route=random.choice(list(MedicationRoute.values)),
                    frequency=random.choice(FREQUENCIES),
                    ordered_by=attending_doctor,
                )
                if nurses and random.random() > 0.4:
                    MedicationAdministration.objects.create(
                        medication_order=med_order,
                        administered_by=random.choice(nurses),
                        status=AdministrationStatus.GIVEN,
                        notes="Administered as prescribed, no adverse reaction observed.",
                    )

            created_count += 1

        self.stdout.write(self.style.SUCCESS(f"  + {created_count} sample admissions created."))
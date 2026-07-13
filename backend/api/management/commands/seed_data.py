import random
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import (
    Role,
    Department,
    Patient,
    Gender,
    Allergy,
    MedicalHistoryNote,
    Visit,
    ConsultationType,
    VisitStatus,
    Invoice,
    InvoiceSourceType,
    InvoiceStatus,
    Payment,
    PaymentMethod,
    QueueEntry,
    QueueType,
    QueueStatus,
    VitalSigns,
    ICD10Code,
    Consultation,
    ConsultationStatus,
    ConsultationDiagnosis,
    Prescription,
    LabTestCatalog,
    LabOrder,
    LabOrderStatus,
    LabResult,
    RadiologyTestCatalog,
    RadiologyOrder,
    RadiologyOrderStatus,
    RadiologyResult,
    Supplier,
    Medicine,
    MedicineBatch,
    StockTransaction,
    StockTransactionType,
    PharmacyDispense,
)

User = get_user_model()
DEFAULT_PASSWORD = "password123"


class Command(BaseCommand):
    help = "Seed AfyaMoja with realistic Kenyan hospital data for development/demo purposes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete existing seeded data (non-superuser) before seeding.",
        )

    def handle(self, *args, **options):
        with transaction.atomic():
            if options["flush"]:
                self._flush()

            self.stdout.write(self.style.WARNING("Seeding AfyaMoja hospital data..."))

            users = self._seed_users()
            departments = self._seed_departments()
            self._seed_icd10()
            lab_tests = self._seed_lab_catalog()
            rad_tests = self._seed_radiology_catalog()
            suppliers = self._seed_suppliers()
            medicines = self._seed_medicines(suppliers)
            patients = self._seed_patients(users)
            self._seed_visits_and_downstream(
                users, departments, patients, lab_tests, rad_tests, medicines
            )

        self.stdout.write(self.style.SUCCESS("✅ Seed data created successfully."))
        self.stdout.write(self.style.SUCCESS(f"   Default password for all users: {DEFAULT_PASSWORD}"))

    # ------------------------------------------------------------------
    def _flush(self):
        self.stdout.write(self.style.WARNING("Flushing existing non-superuser seeded data..."))
        PharmacyDispense.objects.all().delete()
        StockTransaction.objects.all().delete()
        MedicineBatch.objects.all().delete()
        Medicine.objects.all().delete()
        Supplier.objects.all().delete()
        RadiologyResult.objects.all().delete()
        RadiologyOrder.objects.all().delete()
        RadiologyTestCatalog.objects.all().delete()
        LabResult.objects.all().delete()
        LabOrder.objects.all().delete()
        LabTestCatalog.objects.all().delete()
        Prescription.objects.all().delete()
        ConsultationDiagnosis.objects.all().delete()
        Consultation.objects.all().delete()
        ICD10Code.objects.all().delete()
        VitalSigns.objects.all().delete()
        QueueEntry.objects.all().delete()
        Payment.objects.all().delete()
        Invoice.objects.all().delete()
        Visit.objects.all().delete()
        Allergy.objects.all().delete()
        MedicalHistoryNote.objects.all().delete()
        Patient.objects.all().delete()
        Department.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()

    # ------------------------------------------------------------------
    def _seed_users(self):
        self.stdout.write("Creating staff users...")

        staff = [
            # username, first, last, role, phone
            ("admin.wanjiru", "Grace", "Wanjiru", Role.SUPER_ADMIN, "0722100001"),
            ("frontdesk.otieno", "Brian", "Otieno", Role.RECEPTIONIST, "0722100002"),
            ("frontdesk.achieng", "Faith", "Achieng", Role.RECEPTIONIST, "0722100003"),
            ("cashier.mutiso", "Peter", "Mutiso", Role.CASHIER, "0722100004"),
            ("cashier.nafula", "Sharon", "Nafula", Role.CASHIER, "0722100005"),
            ("nurse.chebet", "Mercy", "Chebet", Role.NURSE, "0722100006"),
            ("nurse.kamau", "Joseph", "Kamau", Role.NURSE, "0722100007"),
            ("dr.mwangi", "Daniel", "Mwangi", Role.DOCTOR, "0722100008"),
            ("dr.njeri", "Susan", "Njeri", Role.DOCTOR, "0722100009"),
            ("dr.omondi", "Kevin", "Omondi", Role.DOCTOR, "0722100010"),
            ("dr.wafula", "Ann", "Wafula", Role.DOCTOR, "0722100011"),
            ("lab.kiprono", "Edwin", "Kiprono", Role.LAB_TECHNOLOGIST, "0722100012"),
            ("lab.atieno", "Linet", "Atieno", Role.LAB_TECHNOLOGIST, "0722100013"),
            ("radiology.mbugua", "Samuel", "Mbugua", Role.RADIOLOGIST, "0722100014"),
            ("pharmacy.wambui", "Caroline", "Wambui", Role.PHARMACIST, "0722100015"),
            ("pharmacy.kilonzo", "Josphat", "Kilonzo", Role.PHARMACIST, "0722100016"),
            ("accounts.muthoni", "Eunice", "Muthoni", Role.ACCOUNTANT, "0722100017"),
        ]

        created_users = {}
        for username, first, last, role, phone in staff:
            user, was_created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "email": f"{username}@afyamoja.co.ke",
                    "role": role,
                    "phone": f"+254{phone[1:]}",
                    "is_staff": True,
                    "is_active_staff": True,
                },
            )
            if was_created:
                user.set_password(DEFAULT_PASSWORD)
                user.save()
            created_users[username] = user

        # Superuser for Django admin
        if not User.objects.filter(username="superadmin").exists():
            su = User.objects.create_superuser(
                username="superadmin",
                email="superadmin@afyamoja.co.ke",
                password=DEFAULT_PASSWORD,
                first_name="System",
                last_name="Administrator",
                role=Role.SUPER_ADMIN,
                phone="+254722000000",
            )
            created_users["superadmin"] = su

        return created_users

    # ------------------------------------------------------------------
    def _seed_departments(self):
        self.stdout.write("Creating departments...")
        data = [
            ("General Medicine", 500, "Outpatient general consultation and treatment."),
            ("Pediatrics", 700, "Child health, immunization and growth monitoring."),
            ("Gynecology & Obstetrics", 1000, "Women's reproductive health and maternity."),
            ("Dental", 800, "Oral health, extractions, fillings and cleaning."),
            ("Surgical", 1500, "Minor and major surgical procedures."),
            ("ENT", 900, "Ear, nose and throat specialist care."),
            ("Orthopedics", 1200, "Bone, joint and musculoskeletal care."),
            ("Dermatology", 850, "Skin, hair and nail conditions."),
        ]
        departments = {}
        for name, fee, desc in data:
            dept, _ = Department.objects.get_or_create(
                name=name, defaults={"consultation_fee": fee, "description": desc}
            )
            departments[name] = dept
        return departments

    # ------------------------------------------------------------------
    def _seed_icd10(self):
        self.stdout.write("Loading ICD-10 codes...")
        data = [
            ("A09", "Diarrhoea and gastroenteritis of presumed infectious origin", "Infectious diseases"),
            ("B54", "Unspecified malaria", "Infectious diseases"),
            ("E11", "Type 2 diabetes mellitus", "Endocrine"),
            ("I10", "Essential (primary) hypertension", "Circulatory"),
            ("J00", "Acute nasopharyngitis (common cold)", "Respiratory"),
            ("J02.9", "Acute pharyngitis, unspecified", "Respiratory"),
            ("J18.9", "Pneumonia, unspecified organism", "Respiratory"),
            ("J45", "Asthma", "Respiratory"),
            ("K29.7", "Gastritis, unspecified", "Digestive"),
            ("K35.8", "Acute appendicitis", "Digestive"),
            ("L23", "Allergic contact dermatitis", "Skin"),
            ("N39.0", "Urinary tract infection, site not specified", "Genitourinary"),
            ("O26.9", "Pregnancy related condition, unspecified", "Pregnancy/Obstetrics"),
            ("R50.9", "Fever, unspecified", "Symptoms/Signs"),
            ("R51", "Headache", "Symptoms/Signs"),
            ("S52.5", "Fracture of lower end of radius", "Injury"),
            ("T14.1", "Open wound of unspecified body region", "Injury"),
            ("Z00.0", "General medical examination", "Factors influencing health status"),
            ("Z34.9", "Supervision of normal pregnancy, unspecified", "Pregnancy/Obstetrics"),
            ("U07.1", "COVID-19", "Infectious diseases"),
        ]
        for code, desc, category in data:
            ICD10Code.objects.get_or_create(code=code, defaults={"description": desc, "category": category})

    # ------------------------------------------------------------------
    def _seed_lab_catalog(self):
        self.stdout.write("Creating laboratory test catalog...")
        data = [
            ("LAB-CBC", "Complete Blood Count (CBC)", 800),
            ("LAB-MAL", "Malaria Test (MRDT)", 300),
            ("LAB-MPS", "Malaria Parasites (Blood Slide)", 250),
            ("LAB-URI", "Urinalysis", 350),
            ("LAB-BSUG", "Random Blood Sugar", 300),
            ("LAB-FBS", "Fasting Blood Sugar", 350),
            ("LAB-LFT", "Liver Function Test (LFT)", 1500),
            ("LAB-KFT", "Kidney Function Test (KFT)", 1500),
            ("LAB-HIV", "HIV Test (Rapid)", 0),
            ("LAB-WID", "Widal Test (Typhoid)", 500),
            ("LAB-PREG", "Pregnancy Test (BHCG)", 300),
            ("LAB-LIPID", "Lipid Profile", 1800),
            ("LAB-HBA1C", "HbA1c (Diabetes Monitoring)", 2000),
            ("LAB-STOOL", "Stool Analysis", 400),
            ("LAB-CRP", "C-Reactive Protein (CRP)", 1200),
        ]
        tests = {}
        for code, name, price in data:
            t, _ = LabTestCatalog.objects.get_or_create(code=code, defaults={"name": name, "price": price})
            tests[code] = t
        return tests

    # ------------------------------------------------------------------
    def _seed_radiology_catalog(self):
        self.stdout.write("Creating radiology test catalog...")
        data = [
            ("RAD-XR-CH", "Chest X-Ray", 1500),
            ("RAD-XR-LMB", "Limb X-Ray", 1500),
            ("RAD-USS-ABD", "Abdominal Ultrasound", 2500),
            ("RAD-USS-OBS", "Obstetric Ultrasound", 2800),
            ("RAD-ECG", "Electrocardiogram (ECG)", 1200),
            ("RAD-CT-HEAD", "CT Scan - Head", 8500),
            ("RAD-MRI-SPINE", "MRI - Spine", 15000),
        ]
        tests = {}
        for code, name, price in data:
            t, _ = RadiologyTestCatalog.objects.get_or_create(code=code, defaults={"name": name, "price": price})
            tests[code] = t
        return tests

    # ------------------------------------------------------------------
    def _seed_suppliers(self):
        self.stdout.write("Creating pharmaceutical suppliers...")
        data = [
            ("Beta Healthcare International", "0733222001", "sales@betahealthcare.co.ke", "Baba Dogo Rd, Nairobi"),
            ("Cosmos Pharmaceuticals Ltd", "0733222002", "orders@cosmos.co.ke", "Enterprise Rd, Nairobi"),
            ("Regal Pharmaceuticals", "0733222003", "info@regalpharma.co.ke", "Mombasa Rd, Nairobi"),
            ("Universal Corporation Ltd", "0733222004", "supply@universalcorp.co.ke", "Kikuyu, Kiambu"),
            ("Elys Chemical Industries", "0733222005", "sales@elyschem.co.ke", "Athi River, Machakos"),
        ]
        suppliers = {}
        for name, phone, email, address in data:
            s, _ = Supplier.objects.get_or_create(
                name=name,
                defaults={"phone": f"+254{phone[1:]}", "email": email, "address": address},
            )
            suppliers[name] = s
        return suppliers

    # ------------------------------------------------------------------
    def _seed_medicines(self, suppliers):
        self.stdout.write("Creating medicines and stock batches...")
        supplier_list = list(suppliers.values())
        data = [
            ("Paracetamol 500mg", "Paracetamol", "Analgesic", "tablet", 5, 200),
            ("Amoxicillin 500mg", "Amoxicillin", "Antibiotic", "capsule", 12, 150),
            ("Metformin 500mg", "Metformin", "Antidiabetic", "tablet", 8, 100),
            ("Amlodipine 5mg", "Amlodipine", "Antihypertensive", "tablet", 10, 100),
            ("Artemether/Lumefantrine (Coartem)", "Artemether/Lumefantrine", "Antimalarial", "tablet", 150, 80),
            ("ORS Sachets", "Oral Rehydration Salts", "Rehydration", "sachet", 30, 200),
            ("Ibuprofen 400mg", "Ibuprofen", "Analgesic/NSAID", "tablet", 6, 200),
            ("Diclofenac Gel", "Diclofenac", "Topical NSAID", "tube", 250, 40),
            ("Cetirizine 10mg", "Cetirizine", "Antihistamine", "tablet", 7, 150),
            ("Omeprazole 20mg", "Omeprazole", "PPI", "capsule", 15, 120),
            ("Amoxiclav 625mg", "Amoxicillin/Clavulanate", "Antibiotic", "tablet", 35, 90),
            ("Salbutamol Inhaler", "Salbutamol", "Bronchodilator", "inhaler", 450, 30),
            ("Ferrous Sulphate + Folic Acid", "Ferrous Sulphate", "Hematinic", "tablet", 4, 250),
            ("Multivitamin Syrup", "Multivitamin", "Supplement", "bottle", 300, 50),
            ("Amoxicillin Syrup (Pediatric)", "Amoxicillin", "Antibiotic", "bottle", 180, 60),
            ("Hydrocortisone Cream 1%", "Hydrocortisone", "Topical steroid", "tube", 200, 40),
            ("Doxycycline 100mg", "Doxycycline", "Antibiotic", "capsule", 10, 100),
            ("Metronidazole 400mg", "Metronidazole", "Antibiotic", "tablet", 6, 150),
        ]
        medicines = {}
        for name, generic, category, unit, price, qty in data:
            med, _ = Medicine.objects.get_or_create(
                name=name,
                defaults={
                    "generic_name": generic,
                    "category": category,
                    "unit": unit,
                    "unit_price": price,
                    "reorder_level": 20,
                },
            )
            medicines[name] = med

            if not med.batches.exists():
                batch = MedicineBatch.objects.create(
                    medicine=med,
                    supplier=random.choice(supplier_list),
                    batch_number=f"BN-{random.randint(10000, 99999)}",
                    quantity_received=qty,
                    quantity_remaining=qty,
                    expiry_date=date.today() + timedelta(days=random.randint(180, 720)),
                )
                StockTransaction.objects.create(
                    medicine=med,
                    batch=batch,
                    transaction_type=StockTransactionType.STOCK_IN,
                    quantity=qty,
                    reason="Initial stock seed",
                )
        return medicines

    # ------------------------------------------------------------------
    def _seed_patients(self, users):
        self.stdout.write("Registering patients...")

        kenyan_patients = [
            ("John Kamau Mwangi", Gender.MALE, "1988-03-14", "0711223344", "Kilimani, Nairobi", "22334455"),
            ("Mary Wanjiku Njoroge", Gender.FEMALE, "1995-07-22", "0722334455", "Kasarani, Nairobi", "23445566"),
            ("Peter Otieno Owino", Gender.MALE, "1979-11-02", "0733445566", "Kisumu Central, Kisumu", "24556677"),
            ("Faith Chebet Kiprop", Gender.FEMALE, "2001-01-30", "0744556677", "Eldoret Town, Uasin Gishu", "25667788"),
            ("Ibrahim Hassan Abdi", Gender.MALE, "1992-05-18", "0755667788", "Eastleigh, Nairobi", "26778899"),
            ("Grace Achieng Odhiambo", Gender.FEMALE, "1985-09-09", "0766778899", "Nyalenda, Kisumu", "27889900"),
            ("Samuel Kiptoo Rotich", Gender.MALE, "1998-12-25", "0777889900", "Ngong, Kajiado", "28990011"),
            ("Esther Nafula Wekesa", Gender.FEMALE, "1990-02-14", "0788990011", "Bungoma Town, Bungoma", "29001122"),
            ("David Mutiso Kioko", Gender.MALE, "1975-06-06", "0799001122", "Machakos Town, Machakos", "30112233"),
            ("Lucy Wambui Kariuki", Gender.FEMALE, "2003-04-11", "0700112233", "Thika, Kiambu", "31223344"),
            ("Moses Njogu Wachira", Gender.MALE, "1983-08-19", "0711334455", "Nakuru Town, Nakuru", "32334455"),
            ("Agnes Moraa Nyabuti", Gender.FEMALE, "1997-10-03", "0722445566", "Kisii Town, Kisii", "33445566"),
            ("Hassan Juma Bakari", Gender.MALE, "1968-01-27", "0733556677", "Nyali, Mombasa", "34556677"),
            ("Winnie Adhiambo Ochieng", Gender.FEMALE, "1993-03-08", "0744667788", "Kibra, Nairobi", "35667788"),
            ("Collins Barasa Simiyu", Gender.MALE, "1989-07-16", "0755778899", "Kitale Town, Trans Nzoia", "36778899"),
        ]

        pediatric_patients = [
            ("Baby Amani Wanjala", Gender.FEMALE, "2022-06-01", "Kasarani, Nairobi", "Susan Wanjala", "0722998877", "Mother"),
            ("Baby Kelvin Otieno", Gender.MALE, "2021-11-15", "Nyalenda, Kisumu", "James Otieno", "0733998877", "Father"),
        ]

        receptionists = [u for u in users.values() if u.role == Role.RECEPTIONIST]
        patients = []

        for full_name, gender, dob, phone, address, nid in kenyan_patients:
            p, _ = Patient.objects.get_or_create(
                national_id=nid,
                defaults={
                    "full_name": full_name,
                    "gender": gender,
                    "dob": dob,
                    "phone": f"+254{phone[1:]}",
                    "address": address,
                    "next_of_kin_name": "Emergency Contact",
                    "next_of_kin_phone": f"+254{phone[1:]}",
                    "next_of_kin_relationship": "Spouse",
                    "created_by": random.choice(receptionists) if receptionists else None,
                },
            )
            patients.append(p)

        for full_name, gender, dob, address, guardian, guardian_phone, relationship in pediatric_patients:
            p, _ = Patient.objects.get_or_create(
                full_name=full_name,
                dob=dob,
                defaults={
                    "gender": gender,
                    "address": address,
                    "guardian_name": guardian,
                    "guardian_phone": f"+254{guardian_phone[1:]}",
                    "guardian_relationship": relationship,
                    "created_by": random.choice(receptionists) if receptionists else None,
                },
            )
            patients.append(p)

        # A handful of allergies / history notes for realism
        if patients:
            Allergy.objects.get_or_create(
                patient=patients[0],
                substance="Penicillin",
                defaults={"reaction": "Skin rash and swelling", "severity": "SEVERE"},
            )
            Allergy.objects.get_or_create(
                patient=patients[1],
                substance="Sulfa drugs",
                defaults={"reaction": "Nausea", "severity": "MILD"},
            )
            MedicalHistoryNote.objects.get_or_create(
                patient=patients[8],
                condition="Type 2 Diabetes Mellitus",
                defaults={"notes": "Diagnosed 2019, on Metformin.", "diagnosed_date": "2019-05-10"},
            )
            MedicalHistoryNote.objects.get_or_create(
                patient=patients[12],
                condition="Hypertension",
                defaults={"notes": "On Amlodipine 5mg once daily.", "diagnosed_date": "2020-02-20"},
            )

        return patients

    # ------------------------------------------------------------------
    def _seed_visits_and_downstream(self, users, departments, patients, lab_tests, rad_tests, medicines):
        self.stdout.write("Creating sample visits, consultations, billing and queue records...")

        doctors = [u for u in users.values() if u.role == Role.DOCTOR]
        nurses = [u for u in users.values() if u.role == Role.NURSE]
        cashiers = [u for u in users.values() if u.role == Role.CASHIER]
        receptionists = [u for u in users.values() if u.role == Role.RECEPTIONIST]
        lab_techs = [u for u in users.values() if u.role == Role.LAB_TECHNOLOGIST]
        radiologists = [u for u in users.values() if u.role == Role.RADIOLOGIST]
        pharmacists = [u for u in users.values() if u.role == Role.PHARMACIST]

        dept_list = list(departments.values())
        med_list = list(medicines.values())
        lab_test_list = list(lab_tests.values())
        rad_test_list = list(rad_tests.values())
        icd_codes = list(ICD10Code.objects.all())

        complaints = [
            "Fever and headache for 3 days",
            "Persistent cough and chest pain",
            "Abdominal pain and vomiting",
            "Joint pain and swelling in the knee",
            "Skin rash with itching",
            "Routine antenatal checkup",
            "Toothache and gum swelling",
            "Difficulty breathing",
        ]

        for idx, patient in enumerate(patients[:10]):
            dept = random.choice(dept_list)
            doctor = random.choice(doctors) if doctors else None

            visit = Visit.objects.create(
                patient=patient,
                department=dept,
                doctor=doctor,
                consultation_type=ConsultationType.GENERAL,
                consultation_fee=dept.consultation_fee,
                status=VisitStatus.COMPLETED if idx % 2 == 0 else VisitStatus.IN_QUEUE,
                registered_by=random.choice(receptionists) if receptionists else None,
            )

            # Vitals
            VitalSigns.objects.get_or_create(
                visit=visit,
                defaults={
                    "weight_kg": round(random.uniform(45, 95), 1),
                    "height_cm": round(random.uniform(150, 190), 1),
                    "temperature_c": round(random.uniform(36.2, 39.0), 1),
                    "pulse_bpm": random.randint(60, 110),
                    "respiratory_rate": random.randint(14, 24),
                    "bp_systolic": random.randint(100, 140),
                    "bp_diastolic": random.randint(65, 90),
                    "oxygen_saturation": random.randint(94, 100),
                    "recorded_by": random.choice(nurses) if nurses else None,
                },
            )

            # Consultation invoice + payment
            invoice = Invoice.objects.create(
                patient=patient,
                visit=visit,
                source_type=InvoiceSourceType.CONSULTATION,
                description=f"Consultation - {dept.name}",
                amount=dept.consultation_fee,
            )

            method = random.choice([PaymentMethod.MPESA, PaymentMethod.CASH, PaymentMethod.INSURANCE])
            Payment.objects.create(
                invoice=invoice,
                amount=dept.consultation_fee,
                method=method,
                reference_number=f"S{random.randint(10000000, 99999999)}KE" if method == PaymentMethod.MPESA else "",
                cashier=random.choice(cashiers) if cashiers else None,
            )
            invoice.amount_paid = dept.consultation_fee
            invoice.recalculate_status()

            # Queue entry
            QueueEntry.objects.create(
                patient=patient,
                visit=visit,
                queue_type=QueueType.DOCTOR,
                status=QueueStatus.COMPLETED if visit.status == VisitStatus.COMPLETED else QueueStatus.WAITING_DOCTOR,
                assigned_to=doctor,
                priority=1 if idx == 0 else 0,
            )

            if visit.status != VisitStatus.COMPLETED or not doctor:
                continue

            # Consultation
            consultation = Consultation.objects.create(
                visit=visit,
                doctor=doctor,
                chief_complaint=random.choice(complaints),
                history_of_present_illness="Symptoms started a few days prior to presentation; no similar past episodes reported.",
                physical_examination="Patient alert and oriented. Vitals stable. No acute distress noted on examination.",
                treatment_plan="Symptomatic treatment prescribed. Advised to return if symptoms worsen or persist beyond 5 days.",
                clinical_notes="Reviewed and counselled on medication adherence.",
                status=ConsultationStatus.COMPLETED,
                completed_at=timezone.now(),
            )

            if icd_codes:
                diag_code = random.choice(icd_codes)
                ConsultationDiagnosis.objects.get_or_create(
                    consultation=consultation,
                    icd10_code=diag_code,
                    defaults={"is_primary": True, "notes": "Primary working diagnosis."},
                )

            # Prescription + dispense
            if med_list:
                medicine = random.choice(med_list)
                prescription = Prescription.objects.create(
                    consultation=consultation,
                    medicine=medicine,
                    dosage="1 tablet" if medicine.unit == "tablet" else f"1 {medicine.unit}",
                    frequency="2x daily",
                    duration="5 days",
                    quantity=10,
                    instructions="After meals",
                )
                batch = medicine.batches.filter(is_deleted=False).order_by("expiry_date").first()
                if batch and batch.quantity_remaining >= 10 and pharmacists:
                    pharmacy_invoice = Invoice.objects.create(
                        patient=patient,
                        visit=visit,
                        source_type=InvoiceSourceType.PHARMACY,
                        description=f"Dispense - {medicine.name}",
                        amount=medicine.unit_price * 10,
                    )
                    Payment.objects.create(
                        invoice=pharmacy_invoice,
                        amount=medicine.unit_price * 10,
                        method=PaymentMethod.MPESA,
                        reference_number=f"S{random.randint(10000000, 99999999)}KE",
                        cashier=random.choice(cashiers) if cashiers else None,
                    )
                    pharmacy_invoice.amount_paid = medicine.unit_price * 10
                    pharmacy_invoice.recalculate_status()

                    PharmacyDispense.objects.create(
                        prescription=prescription,
                        batch=batch,
                        quantity_dispensed=10,
                        invoice=pharmacy_invoice,
                        dispensed_by=random.choice(pharmacists),
                    )
                    prescription.is_dispensed = True
                    prescription.save(update_fields=["is_dispensed"])

                    batch.quantity_remaining -= 10
                    batch.save(update_fields=["quantity_remaining"])
                    StockTransaction.objects.create(
                        medicine=medicine,
                        batch=batch,
                        transaction_type=StockTransactionType.STOCK_OUT,
                        quantity=-10,
                        reason=f"Dispensed for visit {visit.visit_number}",
                        performed_by=random.choice(pharmacists),
                    )

            # Occasionally add a lab order
            if idx % 3 == 0 and lab_test_list and lab_techs:
                test = random.choice(lab_test_list)
                lab_invoice = Invoice.objects.create(
                    patient=patient,
                    visit=visit,
                    source_type=InvoiceSourceType.LAB,
                    description=f"Lab - {test.name}",
                    amount=test.price,
                )
                if test.price > 0:
                    Payment.objects.create(
                        invoice=lab_invoice,
                        amount=test.price,
                        method=PaymentMethod.CASH,
                        cashier=random.choice(cashiers) if cashiers else None,
                    )
                    lab_invoice.amount_paid = test.price
                lab_invoice.recalculate_status()

                lab_order = LabOrder.objects.create(
                    consultation=consultation,
                    test=test,
                    status=LabOrderStatus.COMPLETED,
                    is_paid=test.price == 0 or lab_invoice.status == InvoiceStatus.PAID,
                    invoice=lab_invoice,
                    ordered_by=doctor,
                )
                LabResult.objects.create(
                    lab_order=lab_order,
                    result_text="Results within normal limits." if idx % 2 == 0 else "Mild abnormality noted, clinical correlation advised.",
                    technologist=random.choice(lab_techs),
                    completed_at=timezone.now(),
                )

            # Occasionally add a radiology order
            if idx % 4 == 0 and rad_test_list and radiologists:
                rtest = random.choice(rad_test_list)
                rad_invoice = Invoice.objects.create(
                    patient=patient,
                    visit=visit,
                    source_type=InvoiceSourceType.RADIOLOGY,
                    description=f"Radiology - {rtest.name}",
                    amount=rtest.price,
                )
                Payment.objects.create(
                    invoice=rad_invoice,
                    amount=rtest.price,
                    method=PaymentMethod.MPESA,
                    reference_number=f"S{random.randint(10000000, 99999999)}KE",
                    cashier=random.choice(cashiers) if cashiers else None,
                )
                rad_invoice.amount_paid = rtest.price
                rad_invoice.recalculate_status()

                rad_order = RadiologyOrder.objects.create(
                    consultation=consultation,
                    test=rtest,
                    status=RadiologyOrderStatus.REPORTED,
                    is_paid=True,
                    invoice=rad_invoice,
                    ordered_by=doctor,
                )
                RadiologyResult.objects.create(
                    radiology_order=rad_order,
                    radiologist_notes="No acute abnormality detected.",
                    radiologist=random.choice(radiologists),
                    completed_at=timezone.now(),
                )
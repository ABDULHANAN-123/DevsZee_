/**
 * Fictional hackathon fixture. These are NOT verified real-business facts.
 * Replace these documents with owner-approved content before a real deployment.
 */
export interface BusinessDocument {
  id: string;
  topic: string;
  title: string;
  sourceType: "demo_fixture";
  status: "fictional_demo";
  content: string;
}

export const businessDocuments: BusinessDocument[] = [
  {
    id: "noor-academy-courses",
    topic: "courses",
    title: "Noor Academy Courses and Learning Format",
    sourceType: "demo_fixture",
    status: "fictional_demo",
    content: `NOOR ONLINE QURAN ACADEMY — DEMO INFORMATION ONLY
Topic: courses and services. Search phrases: courses, classes, Quran
programs, what courses do you offer, course options.
Demo courses: Noorani Qaida for beginners, Quran reading with Tajweed,
Quran memorization (Hifz), and basic Islamic studies for children.
Classes are online. Students need a stable internet connection and a
device with audio. Course duration, levels, trial availability, certificates,
and actual availability are not established by this fixture; confirm them
with a human representative.`,
  },
  {
    id: "noor-academy-fees",
    topic: "fees",
    title: "Noor Academy Fictional Demo Fee Examples",
    sourceType: "demo_fixture",
    status: "fictional_demo",
    content: `NOOR ONLINE QURAN ACADEMY — FICTIONAL DEMO FEES, NOT REAL PRICES
Topic: course fees. Search phrases: fee structure, course-wise fees, monthly
charges, tuition, admission cost, cost to enroll, registration fee.
For testing only: Noorani Qaida PKR 4,000/month; Quran reading with
Tajweed PKR 5,000/month; Hifz PKR 7,000/month. These are invented
sample prices and must never be presented as real or confirmed fees.
This fixture does not specify registration charges, payment methods, payment
deadlines, accepted payment methods, bank transfer, card payments, payment
instructions, payment confirmation, receipts, transaction references,
failed or pending payments, or additional charges. Discounts, refunds, refund
eligibility, cancellation conditions, refund request procedure, refund
deadlines, refund processing time, and refund exceptions require human
confirmation; no discount or refund policy is stated here.
Search phrases: how to pay, payment options, payment due date, payment pending,
failed payment, cancel course, money back, fee wapis, refund policy.`,
  },
  {
    id: "noor-academy-timings",
    topic: "timings",
    title: "Noor Academy Fictional Demo Class Timing Window",
    sourceType: "demo_fixture",
    status: "fictional_demo",
    content: `NOOR ONLINE QURAN ACADEMY — DEMO TIMINGS ONLY
Topic: class timings and scheduling. Search phrases: class time, schedule,
available hours, timing, when are classes, time slots.
Example availability window: 9:00 AM to 9:00 PM Pakistan Standard Time.
This is not a confirmed schedule. Teacher availability and the student's
preferred timetable must be confirmed by the academy team. Days, session
duration, available days, weekend availability, rescheduling, schedule changes,
and cancellation rules are not specified in this fixture.
Search phrases: class schedule, time slots, weekdays, weekends, lesson length,
reschedule a class, change timing, cancel a lesson.`,
  },
  {
    id: "noor-academy-admissions",
    topic: "admissions",
    title: "Noor Academy Demo Consultation and Admission Notes",
    sourceType: "demo_fixture",
    status: "fictional_demo",
    content: `NOOR ONLINE QURAN ACADEMY — DEMO ADMISSIONS PROCESS
Topic: admissions and enrollment. Search phrases: how to enroll, admission
steps, application, registration, join a course, consultation.
Prospective students may request a course consultation. Ask for the
student/guardian name, contact number, requested course, and preferred
timing. A human representative confirms teacher availability, fees,
admission, trial classes, certificates, and policies. Eligibility, required
documents, enrollment deadlines, registration steps, assessment requirements,
admission confirmation timing, and post-application steps are not specified.
Do not promise enrollment or any policy without confirmation.
Search phrases: application documents, admission requirements, eligibility,
registration process, enrollment deadline, after applying, contact support,
human assistance.`,
  },
];
